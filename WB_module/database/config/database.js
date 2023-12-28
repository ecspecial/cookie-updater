import chalk from 'chalk';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

// Конфигурация ссылок управления MongoDB

// Строка подключения к БД, которая хранит аккаунты, прокси 
const uri = `mongodb://${process.env.BACKEND_DB_USER}:${process.env.BACKEND_DB_PASSWORD}@${process.env.BACKEND_DB_HOST}/${process.env.BACKEND_DB_NAME}`;

// Строка подключения к БД для управления списыванием баланса с юзеров 
const uri2 = `mongodb://${process.env.PAYMENT_DB_USER}:${process.env.PAYMENT_DB_PASSWORD}@${process.env.PAYMENT_DB_HOST}/${process.env.PAYMENT_DB_NAME}`;

// Строка подключения к продакшн БД
const uri3 = `mongodb://${process.env.PRODUCTION_DB_USER}:${process.env.PRODUCTION_DB_PASSWORD}@${process.env.PRODUCTION_DB_HOST}/${process.env.PRODUCTION_DB_NAME}`;

let client;
let client2;
let client3;

let isConnected = false;
let isConnected2 = false;
let isConnected3 = false;

// Подключение к базе данных 
const databaseConnectRequest = async () => {
  try {
    client = new MongoClient(uri);
  
    // Установка опции poolSize непосредственно при вызове connect
    await client.connect({
      poolSize: 10, // Установка размера пула соединений
    });
    isConnected = true;
    console.log(chalk.green('Успешно подключились к базе данных '));
  } catch (err) {
    console.error('Ошибка подключения к базе данных :', err);
  }
  
  return isConnected;
};

// Подключение к базе данных payments
const database2ConnectRequest  = async () => {
  try {
    client2 = new MongoClient(uri2);
  
    // Установка опции poolSize непосредственно при вызове connect
    await client2.connect({
      poolSize: 10, // Установка размера пула соединений
    });
    isConnected2 = true;
    console.log(chalk.green('Успешно подключились к базе данных '));
  } catch (err) {
    console.error('Ошибка подключения к базе данных :', err);
  }
  
  return isConnected2;
};

// Подключение к базе данных 
const database3ConnectRequest  = async () => {
  try {
    client3 = new MongoClient(uri3);
  
    // Установка опции poolSize непосредственно при вызове connect
    await client3.connect({
      poolSize: 10, // Установка размера пула соединений
    });
    isConnected3 = true;
    console.log(chalk.green('Успешно подключились к базе данных '));
  } catch (err) {
    console.error('Ошибка подключения к базе данных :', err);
  }
  
  return isConnected3;
};

// Получение объекта базы данных 
const getDb = () => client.db();

// Получение объекта базы данных 
const getDb2 = () => client2.db();

// Получение объекта базы данных 
const getDb3 = () => client3.db();

// Закрытие соединения с базой данных 
const closeDatabase = () => client.close();

// Закрытие соединения с базой данных
const closeDatabase2 = () => client2.close();

// Закрытие соединения с базой данных
const closeDatabase3 = () => client3.close();

// Экспорт функций управления БД
export { databaseConnectRequest, getDb, closeDatabase, database2ConnectRequest, getDb2, closeDatabase2 ,database3ConnectRequest, getDb3, closeDatabase3 };