import cors from 'cors';
import chalk from 'chalk';
import axios from "axios";
import async from 'async';
import dotenv from 'dotenv';
import express from 'express';
import { ObjectId } from 'mongodb';
import { getProxyWithRetries } from './WB_module/queue/utility/resourses.js';
import { checkProxy } from './WB_module/network/controller/networkController.js';
import { sendErrorToTelegram } from "./WB_module/telegram/telegramErrorNotifier.js";
import { updateCookieAfterUse } from "./src/cookie_updater/updater/cookieUpdater.js";
import { getUsedAccounts } from "./src/cookie_updater/controller/cookieUpdaterDbController.js";
import { 
    databaseConnectRequest, 
    getDb 
} from "./WB_module/database/config/database.js";

dotenv.config();

// Настройка сервера express + использование cors и json
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4004;

const INTERVAL_USED_LIKES = 20000; 
const MAX_PARALLEL_UPDATES = 1;

// Настройка максимально допустимых значений повторного добавления в очередь
const RETRY_LIMIT = 3;
const READD_RETRY_LIMIT = 10;

// Настройка максимально допустимых значений повторного получения прокси
const PROXY_RETRY_LIMIT = 10;

let activeUpdateTasks = 0;

const startServer = async () => {
    try {
        console.log('Попытка подключения к базе данных...');
        const isConnected = await databaseConnectRequest();
        if (!isConnected) {
            throw new Error('Подключение к базе данных не может быть установлено');
        }

        console.log(chalk.grey('Запускаем сервер...'));
        app.listen(PORT, async () => {
            console.log(chalk.green(`Сервер запущен на порту ${PORT}`));

            setInterval(async () => {
                try {
                    if (activeUpdateTasks < MAX_PARALLEL_UPDATES) {
                        let eligibleRecords = await getUsedAccounts(activeUpdateTasks);
                        if (eligibleRecords.length > 0) {
                            console.log('Записи готовые к обработке в статусе "used":', eligibleRecords.length);
                            await addEligibleRecordsToQueue(eligibleRecords.slice(0, MAX_PARALLEL_UPDATES - activeUpdateTasks));
                        }
                    }
                } catch (error) {
                    console.error('Ошибка при проверке записей в статусе "used":', error);
                    await sendErrorToTelegram(`Ошибка при проверке записей в статусе "used": ${error.message}`, 'getUsedAccounts');
                }
            }, INTERVAL_USED_LIKES);
        });
        

    } catch (error) {
        console.error(chalk.red('Ошибка при запуске сервера:', error));
        await sendErrorToTelegram(`Ошибка при запуске сервера: ${error.message}`, 'startServer');
    }
};

startServer().then(server => {
    if (server) {
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(chalk.red(`Порт ${PORT} занят!`));
            } else {
                console.error(chalk.red('Произошла ошибка при запуске сервера:'), error);
            }
        });
    }
});

// Логика воркера очереди задач
const updateQueue = async.queue(async (task) => {
    try {
        switch (task.updateRecord.type) {
            case 'accounts':
            case 'mobileaccounts':
                await processUsedAccounts(task)
                break;
            default:
                throw new Error(`Неизвестный тип задачи: ${task.updateRecord.type}`);
        }
    } catch (error) {
        console.error(`Ошибка при обработке 'used' аккаунта ${task.updateRecord._id.toString()}:`, error);
        await sendErrorToTelegram(`Ошибка при обработке 'used' аккаунта ${task.updateRecord._id.toString()}: ${error.message}`, 'updateQueue');

        if (error.message === 'NO_AVAILABLE_PROXY') {
            await reAddToUsedQueueWithTimeout(task.updateRecord, task.retries);
        } else {
            throw error;
        }
    }
}, MAX_PARALLEL_UPDATES);

updateQueue.error((err, task) => {
    console.error('Ошибка при обработке задачи:', err, 'Задача:', task);
});

// Функция добавления задач в очередь
const addEligibleRecordsToQueue = async (eligibleRecords) => {
    const db = getDb();
    for (let record of eligibleRecords) {
        if (activeUpdateTasks < MAX_PARALLEL_UPDATES) {
            await db.collection(record.type).updateOne(
                { _id: record._id },
                { $set: { status: 'updating' } }
            );

            updateQueue.push({ updateRecord: record, retries: 0 });
            activeUpdateTasks++;
        }
    }
};

// Функция добавления updateRecord в очередь с начальным количеством попыток
async function reAddToUsedQueueWithTimeout(updateRecord, retries) {
    if (retries < PROXY_RETRY_LIMIT) {
        await delay(180000);
        updateQueue.unshift({ updateRecord, retries: retries + 1 });
        console.log(`likeId ${updateRecord._id} добавлен обратно в очередь после задержки.`);
    } else {
        totalActiveTasks--;
        console.error(`Максимальное количество попыток для аккаунта 'used' ${updateRecord._id} достигнуто.`);
    }
}

// Функция для повторного добавления updateRecord в очередь с обновленным количеством попыток
async function reAddToUsedQueue(updateRecord, retries) {
    if (retries < RETRY_LIMIT) {
        updateQueue.unshift({ updateRecord, retries: retries + 1 });
    } else {
        console.error(`Максимальное количество попыток для аккаунта 'used' ${updateRecord._id} достигнуто.`);
        activeUpdateTasks--;
    }
}

// Функция для повторного добавления updateRecord в очередь без обновления количества попыток
async function reAddToUsedQueueNoAdd(updateRecord, retries) {
    if (retries < READD_RETRY_LIMIT) {
        await updateQueue.unshift({ updateRecord, retries: retries + 1 });
    } else {
        console.error(`Максимальное количество попыток для аккаунта 'used' ${updateRecord._id} достигнуто.`);
    }
}

// Функция обработки лайков брендов и товаров
async function processUsedAccounts(task) {

    const usedRecord = task.updateRecord;
    const idString = usedRecord._id.toString();
    const db = await getDb();

    try {
        console.log('Обработка', idString);

        const usedAccont  = await db.collection(task.updateRecord.type).findOne({ _id: new ObjectId(idString) });
        if (!usedAccont) {
            console.error(`Не найдена запись для 'used' аккаунта ${idString} в базе данных.`);
            activeUpdateTasks--;
            return;
        }

        if (activeUpdateTasks <= MAX_PARALLEL_UPDATES) {

            let proxy;
            let phoneNumber;
            let accountId;

            proxy = await getProxyWithRetries();
            accountId = idString;
            phoneNumber = task.updateRecord.number;

            const outcome = await updateCookieAfterUse(phoneNumber, proxy);

            if (outcome === 'SUCCESS') {

                const result = await db.collection(task.updateRecord.type).updateOne(
                    { _id: new ObjectId(idString) },
                    {
                        $set: { status: 'free' }
                    }
                );

                if (result.modifiedCount !== 1) {
                    throw new Error(`Не удалось обновить статус для аккаунта ${idString}`);
                }

                console.log(`Обновление куки аккаунта likeId ${idString} успешно`);
                activeUpdateTasks--;

            } else {
                console.error('Ошибка при отправке обновления куки:', outcome);
                await db.collection(task.updateRecord.type).updateOne(
                    { _id: new ObjectId(idString) },
                    { $set: { status: 'used' } }
                );
                reAddToUsedQueue(usedRecord, task.retries);
            }

            // Возвращаем прокси обратно в статус 'free'

            if (proxy) {
                const isProxyWorking = await checkProxy(proxy);
                const updateData = isProxyWorking ? { status: 'free', lastUsedIP: isProxyWorking } : { status: 'free' };
                await db.collection('proxies').updateOne({ proxy: proxy }, { $set: updateData });
            }
        }
        else {
            
        }

    } catch (error) {
        const errorMessage = `Ошибка при обработке исользованного аккаунта ${idString}: ${error.message}`;
        console.error(errorMessage);
        await db.collection(task.updateRecord.type).updateOne(
            { _id: new ObjectId(idString) },
            { $set: { status: 'used' } }
        );
        await sendErrorToTelegram(errorMessage, 'processUsedAccounts');
        throw error;
    }
}