# Frame Broker
Frame Broker is a NodeJS program that forwards data from USB devices onto a Redis channel. Each USB device is represented by a unique channel, and the data is sent as JSON objects.

## Deployment
1. Build using the `npm run build` command.
2. Copy the `dist` folder over to the target machine at `/opt/frame-broker/`.
3. Copy the `node_modules` folder to `/opt/frame-broker/`.
4. Copy the `frame-broker.service` file to `/etc/systemd/system/`.