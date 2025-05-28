import { Device, devicesAsync, HIDAsync } from 'node-hid';
import { shortenString } from './utils/string-utils';
import RedisBroker from './redis-broker';

const MATCH_PRODUCT_NAMES = ['DALIUSBInterface']; // Only add devices with matching product names
const UPDATE_INTERVAL_SECONDS = 30; // Update interval for updating the device list

type DeviceWithEmitter = Device & HIDAsync;
const devicesWithEmitters: DeviceWithEmitter[] = [];

const broker = RedisBroker.getInstance();
broker.start();

(async () => {
    console.log('Starting USB HID device listener...');
    updateDeviceList();
    setInterval(() => {
        updateDeviceList();
    }, UPDATE_INTERVAL_SECONDS * 1000);
})();

async function updateDeviceList() {
    const newDevices = await devicesAsync();
    // Compare paths to the current device list
    const paths = devicesWithEmitters.map((device) => device.path);
    const newPaths = newDevices.map((device) => device.path);

    // Add devices that are not currently in the list, and match the product names
    const addedDevices = devicesWithEmitters.filter(
        (device) =>
            device.product &&
            MATCH_PRODUCT_NAMES.includes(device?.product) &&
            device.path &&
            !paths.includes(device.path)
    );

    // Remove devices that are no longer present in the new list
    const removedDevices = devicesWithEmitters.filter((device) => !newPaths.includes(device.path));

    for (const device of addedDevices) await registerDevice(device);
    for (const device of removedDevices) disposeDevice(device);
}

async function registerDevice(device: Device) {
    if (!device.path) return console.error('Device path is undefined!');
    const emitter = await HIDAsync.open(device.path);
    emitter.on('error', (error) => {
        console.error('Error with device', device.productId, '...', error);
    });

    emitter.on('data', (data) => {
        broker.send(data, `frame-broker:usb:${device.path}`);
    });

    const d = { ...device, ...emitter } as DeviceWithEmitter;
    devicesWithEmitters.push(d);

    console.table({
        path: shortenString(device.path, 20),
        product: device.product,
        manufacturer: device.manufacturer
    });
}

async function disposeDevice(device: DeviceWithEmitter) {
    if (!device.path)
        return console.error('Device path is undefined, cannot remove device with productId', device.productId);

    const index = devicesWithEmitters.findIndex((d) => d.path === device.path);
    if (index !== -1) {
        const emitter = devicesWithEmitters[index];
        emitter.removeAllListeners(); // Remove all listeners to prevent memory leaks
        emitter.close(); // Close the HIDAsync emitter
        devicesWithEmitters.splice(index, 1);
    } else {
        console.error('Device not found in the list:', device);
    }
}
