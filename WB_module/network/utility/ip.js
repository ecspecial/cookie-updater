import os from 'os';

// Функция для получения IP-адреса сервера
const getIPAddress = async () => {
    const interfaces = os.networkInterfaces();
    for (const dev in interfaces) {
        const iface = interfaces[dev];
        for (let i = 0; i < iface.length; i++) {
            const { address, family, internal } = iface[i];
            if (family === 'IPv4' && !internal) {
                return address;
            }
        }
    }
    return '127.0.0.1';
};

export { getIPAddress }