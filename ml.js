"use strict";

const tf = require('@tensorflow/tfjs-node-gpu');
//const wasm = require('@tensorflow/tfjs-backend-wasm');
//const {nodeFileSystemRouter} = require('@tensorflow/tfjs-node/dist/io/file_system');

const URL = 'https://games.dtco.ru/model/model.json';

const BATCH_SIZE  = 128;
const EPOCH_COUNT = 7;
const VALID_SPLIT = 0.1;
const FREEZE_CNT  = 8;

let boards  = null;
let moves   = null;
let count   = 0;

let model   = null;
let isReady = false;

async function init(logger) {
    if (model === null) {
        const t0 = Date.now();
        tf.enableProdMode();
//      await tf.setBackend('wasm');
        await tf.ready();
        model = await tf.loadLayersModel(URL);
        console.log(tf.getBackend());
        logger.info(tf.getBackend());
        for (let i = 0; i < FREEZE_CNT; i++) {
            const l = model.getLayer(null, i);
            l.trainable = false;
        }
        const t1 = Date.now();
        console.log('Load time: ' + (t1 - t0));
        logger.info('Load time: ' + (t1 - t0));
        isReady = true;
    }
}

function ready() {
    return isReady;
}

function InitializeFromFen(fen, batch, size) {
    const offset = batch * size * size;
    let row = 0;
    let col = 0;
    for (let i = 0; i < fen.length; i++) {
         let c = fen.charAt(i);
         if (c == '/') {
             row++;
             col = 0;
             continue;
         }
         if (c >= '0' && c <= '9') {
             col += parseInt(c);
             continue;
         }
         let piece = 0;
         switch (c) {
            case 'W': 
               piece = -1;
               break;
            case 'w': 
               piece = -1;
               break;
            case 'B': 
               piece = 1;
               break;
            case 'b': 
               piece = 1;
               break;
            case 'X':
               piece = 0;
               break;
        }
        const pos = (row * size) + col;
        boards[pos + offset] = piece;
        col++;
    }
}

async function send(setup, move, size, batch) {
//  console.log('[' + count + '] ' + setup + ': ' + move);
    if (boards === null) {
        boards = new Float32Array(batch * size * size);
        moves  = new Float32Array(batch * size * size);   
        count  = 0;
    }
    InitializeFromFen(setup, count, size);
    moves[move + (count * size * size)] = 1;
    count++;
    return false;
}

async function fit(batch, size, logger) {
    isReady = false;
    const xshape = [+batch, 1, +size, +size];
    const xs = tf.tensor4d(boards, xshape, 'float32');
    const yshape = [+batch, +size * +size];
    const ys =  tf.tensor2d(moves, yshape, 'float32');
    const t0 = Date.now();
    model.compile({optimizer: 'sgd', loss: 'categoricalCrossentropy', metrics: ['accuracy']});
    const h = await model.fit(xs, ys, {
        batchSize: BATCH_SIZE,
        epochs: EPOCH_COUNT,
        validationSplit: VALID_SPLIT
    });    
    console.log(h);
    for (let i = 0; i < EPOCH_COUNT; i++) {
        logger.info('epoch = ' + i + ', acc = ' + h.history.acc[i] + ', loss = ' + h.history.loss[i] + ', val_acc = ' + h.history.val_acc[i] + ', val_loss = ' + h.history.val_loss[i]);
    }
    const t1 = Date.now();
    console.log('Fit time: ' + (t1 - t0));
    logger.info('Fit time: ' + (t1 - t0));
    xs.dispose();
    ys.dispose();
    isReady = true;
    boards = null;
    moves  = null;
    count  = 0;
}

async function save(savePath) {
    isReady = false;
    await model.save(`file:///users/valen/${savePath}`);
    isReady = true;
}

module.exports.init    = init;
module.exports.ready   = ready;
module.exports.send    = send;
module.exports.fit     = fit;
module.exports.save    = save;