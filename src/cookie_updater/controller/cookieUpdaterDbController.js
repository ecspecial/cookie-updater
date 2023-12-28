import { ObjectId } from 'mongodb';
import { getDb } from '../../../WB_module/database/config/database.js';


const collectionsToCheck = ['accounts', 'mobileaccounts'];
const MAX_PARALLEL_UPDATES = 1;

// Функция для получения аккаунтов со статусом 'used'
const getUsedAccounts = async (activeUpdateTasks) => {
    try {
        const db = getDb();

        if (activeUpdateTasks >= MAX_PARALLEL_UPDATES) {
            console.log(`Очередь API не принимает новые записи. Пропускаем итерацию.`);
            return [];
        }

        let remainingCapacity = MAX_PARALLEL_UPDATES - activeUpdateTasks;

        let allUsedAccounts = [];
        for (const collectionName of collectionsToCheck) {
            console.log(`Проверка коллекции '${collectionName}' на использованные аккаунты...`);
            let query = { status: 'used' };
            let usedAccounts = await db.collection(collectionName).find(query).toArray();
            allUsedAccounts.push(...usedAccounts);
        }

        if (allUsedAccounts.length > 0) {
            return allUsedAccounts.slice(0, remainingCapacity);
        } else {
            console.log(`В коллекциях '${collectionsToCheck.join(', ')}' записи со статусом 'used' не найдены.`);
            return [];
        }
    } catch (error) {
        console.error("Ошибка при получении аккаунтов со статусом 'used':", error);
        await sendErrorToTelegram(`Ошибка при получении аккаунтов со статусом 'used': ${error.message}`, 'getUsedAccounts');
        throw error;
    }
};

export { getUsedAccounts };