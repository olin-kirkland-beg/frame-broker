import { Device, devicesAsync, HIDAsync } from 'node-hid';
import RedisBroker from './redis-broker';
import { shortenString } from './utils/string-utils';
import { formatDevicePathId } from './utils/id-utils';

const MATCH_PRODUCT_NAMES = ['DALIUSBInterface']; // Only add devices with matching product names

type DeviceWithEmitter = Device & HIDAsync;
const devicesWithEmitters: DeviceWithEmitter[] = [];
const broker = RedisBroker.getInstance('frame-broker:*:out'); // Subscribe to all frame-broker channels
broker.onMessage = onReceiveRedisMessage;
export const pathMap: Record<string, string> = {}; // Map to track device paths by uuid

(async () => {
    await broker.start();

    console.log('Discovering HID devices...');
    const devices = await devicesAsync();
    const filteredDevices = devices.filter((device) => device.product && MATCH_PRODUCT_NAMES.includes(device.product));
    console.log(
        `  ...discovered ${filteredDevices.length}/${devices.length} HID devices matching product names: ${MATCH_PRODUCT_NAMES.join(', ')}`
    );

    for (const device of filteredDevices) await registerDevice(device);
})();

async function registerDevice(device: Device) {
    if (!device.path) return console.error('Device path is undefined!');
    const pathId = formatDevicePathId(device.path); // /dev/hidraw1 -> dev-hidraw1
    pathMap[pathId] = device.path;
    const deviceEmitter = await HIDAsync.open(device.path);
    deviceEmitter.on('error', (error) => {
        console.error('Error with device', device.path, '...', error);
    });

    deviceEmitter.on('data', (data) => {
        // The device has emitted some data, send it to the controller via a redis channel
        try {
            broker.send(data, `frame-broker:${pathId}:in`);
        } catch (error) {
            console.error(`Error processing data from device ${device.path}:`, error);
        }
    });

    const d = { ...device, ...deviceEmitter } as DeviceWithEmitter;
    devicesWithEmitters.push(d);

    console.table({
        path: shortenString(device.path || '[no path]', 20),
        product: device.product,
        manufacturer: device.manufacturer
    });
}

function onReceiveRedisMessage(message: any, channel: string) {
    // A message was received on a Redis channel from the controller
    // Forward it to the appropriate device based on the channel name
    // Format of channel: 'frame-broker:<pathId>:out'
    if (!channel.startsWith('frame-broker:') || !channel.endsWith(':out') || channel.split(':').length !== 3)
        return console.error(`Invalid channel format (${channel}). Expected format: 'frame-broker:<pathId>:out'`);

    const pathPart = channel.split(':')[1]; // Extract the path part from the channel
    const path = pathMap[pathPart]; // Get the actual path from the pathMap
    if (!path) return console.error(`No device found for pathId "${pathPart}"`);

    const device = devicesWithEmitters.find((d) => d.path === path);
    if (!device) return console.error(`No device emitter found for pathId "${path}"`);

    try {
        const { type, data } = JSON.parse(message);
        if (type !== 'Buffer') return;
        const buffer = Buffer.from(data);
        device.write(buffer);
    } catch (error) {
        console.error(`Error sending message to device ${device.path}:`, error);
    }
}
