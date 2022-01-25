"use strict";

const sgf  = require('./parser');
const go   = require('./go');
const ml   = require('./ml');

const fs   = require('fs');
const path = require('path');
const _ = require('underscore');

const winston = require('winston');
require('winston-daily-rotate-file');

const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'HH:mm:ss'
    }),
    winston.format.printf(
        info => `${info.level}: ${info.timestamp} - ${info.message}`
    )
);

var transport = new winston.transports.DailyRotateFile({
    dirname: '',
    filename: 'sgfloader-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d'
});

var logger = winston.createLogger({
    format: logFormat,
    transports: [
      transport
    ]
});

const abc = 'abcdefghijklmnopqrs';

const BATCH_SIZE = 4096;

let SIZE   = 19;    
let once   = true;
let closed = false;

let files   = null;
let ixFile  = 0;
let boards  = [];
let ixBoard = 0;

function loadFiles(dir) {
    files = fs.readdirSync(dir).map(fileName => {
        return path.join(dir, fileName);
    });
    ixFile = 0;
    return files.length > 0;
}

function move(s, SIZE) {
    return _.indexOf(abc, s[0]) + _.indexOf(abc, s[1]) * SIZE;
}

function loadData(bulk, callback) {
    while (bulk > 0) {
        if (ixBoard >= boards.length) {
            if (ixFile >= files.length) return false;
            boards = []; ixBoard = 0; 
            console.log('Loaded: ' + files[ixFile]);
            logger.info('Loaded: ' + files[ixFile]);
            const d = fs.readFileSync(files[ixFile]);
            const data = d.toString();
            const moves = sgf.parse(data);
            let WINNER = '';
            if (moves) {
                let board = new Int32Array(SIZE * SIZE);
                for (let i = 0; i < moves.length; i++) {
                    if (!moves[i].arg[0]) continue;
                    if (moves[i].name == 'SZ') {
                        SIZE = moves[i].arg[0];
                        board = new Int32Array(SIZE * SIZE);
                        continue;
                    }
                    if (moves[i].name == 'RE') {
                        WINNER = moves[i].arg[0][0];
                        continue;
                    }
                    if (moves[i].name == 'AB') {
                        for (let j = 0; j < moves[i].arg.length; j++) {
                            const m = move(moves[i].arg[j], SIZE);
                            board[m] = 1;
                        }
                        continue;
                    }
                    if (moves[i].name == 'AW') {
                        for (let j = 0; j < moves[i].arg.length; j++) {
                            const m = move(moves[i].arg[j], SIZE);
                            board[m] = -1;
                        }
                        continue;
                    }
                    if (moves[i].name == 'B') {
                        const m = move(moves[i].arg[0], SIZE);
                        if (!WINNER || (WINNER == moves[i].name)) {
                            let setups = [];
                            _.each([0, 1, 2, 3, 4, 5, 6, 7], function(rotate) {
                                const s = go.GetFen(board, SIZE, true, rotate);
                                if (_.indexOf(setups, s) >= 0) return;
                                setups.push(s);
                                boards.push({
                                    setup: s,
                                    move: go.transform(m, rotate, SIZE)
                                });
                            });
                        }
                        board = go.RedoMove(board, 1, m, SIZE);
                    }
                    if (moves[i].name == 'W') {
                        const m = move(moves[i].arg[0], SIZE);
                        if (!WINNER || (WINNER == moves[i].name)) {
                            let setups = [];
                            _.each([0, 1, 2, 3, 4, 5, 6, 7], function(rotate) {
                                const s = go.GetFen(board, SIZE, false, rotate);
                                if (_.indexOf(setups, s) >= 0) return;
                                setups.push(s);
                                boards.push({
                                    setup: s,
                                    move: go.transform(m, rotate, SIZE)
                                });
                            });
                        }
                        board = go.RedoMove(board, -1, m, SIZE);
                    }
                }
            }
            ixFile++;
        }
        if (boards[ixBoard]) {
            callback(boards[ixBoard].setup, boards[ixBoard].move, SIZE, BATCH_SIZE);
            bulk--;
        }
        ixBoard++;
    }
    return true;
}

function exec() {
    if (once) {
        once = false;
        if (!loadFiles('./data')) {
            return true;
        }
        ml.init(logger);
        return true;
    }
    if (ml.ready()) {
        if (closed) {
            return false;
        }
        if (!loadData(BATCH_SIZE, ml.send)) {
            ml.save('done.json');
            closed = true;
            return true;
        }
        ml.fit(BATCH_SIZE, SIZE, logger);
        return true;
    }
    return true;
}

let run = function() {
    if (exec()) {
        setTimeout(run, 1000);
    }
}

run();
