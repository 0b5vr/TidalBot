#! /bin/bash

APP_DIR=$HOME/app
APP_NAME=app

LOG_DIR=$HOME/logs
mkdir ${LOG_DIR} -p

cd ${APP_DIR}

jackd -p 32 -d alsa &
sudo /etc/init.d/dbus start

forever start -a -l ${LOG_DIR}/${APP_NAME}_forever.log -o ${LOG_DIR}/${APP_NAME}_stdout.log -e ${LOG_DIR}/${APP_NAME}_stderr.log index.js
forever list
forever --fifo logs 0