"use strict";

const tf = require('@tensorflow/tfjs');

const URL = 'https://games.dtco.ru/model/model.json';

const BATCH_SIZE  = 128;
const EPOCH_COUNT = 5;
const VALID_SPLIT = 0.1;
const FREEZE_CNT  = 0;

let boards = null;
let moves  = null;
let count  = 0;

let model  = null;
let isReady = false;

async function init() {
    if (model === null) {
        const t0 = Date.now();
        tf.enableProdMode();
        await tf.ready();
        model = await tf.loadLayersModel(URL);
        console.log(tf.getBackend());
        for (let i = 0; i < FREEZE_CNT; i++) {
            const l = model.getLayer(null, i);
            l.trainable = false;
        }
        const t1 = Date.now();
        console.log('Load time: ' + (t1 - t0));
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

async function send(setup, move, size) {
    console.log('[' + count + '] ' + setup + ': ' + move);
    if (count >= BATCH_SIZE) {
        const xshape = [BATCH_SIZE, 1, size, size];
        const xs = tf.tensor4d(boards, xshape, 'float32');
        const yshape = [BATCH_SIZE, size * size];
        const ys =  tf.tensor2d(moves, yshape, 'float32');
/*      const t0 = Date.now();
        model.compile({optimizer: 'sgd', loss: 'categoricalCrossentropy', metrics: ['accuracy']});
        const h = await model.fit(xs, ys, {
            batchSize: BATCH_SIZE,
            epochs: EPOCH_COUNT,
            validationSplit: VALID_SPLIT
        });    
        console.log(h);
        const t1 = Date.now();
        console.log('Fit time: ' + (t1 - t0));*/
        xs.dispose();
        ys.dispose();
        boards = null;
        moves  = null;
        count  = 0;
        console.log('true');
        return true;
    }
    if (boards === null) {
        boards = new Float32Array(BATCH_SIZE * size * size);
        moves  = new Float32Array(BATCH_SIZE * size * size);   
        count  = 0;
    }
    InitializeFromFen(setup, count, size);
    moves[move + (count * size * size)] = 1;
    count++;
    console.log('false');
    return false;
}

module.exports.init  = init;
module.exports.ready = ready;
module.exports.send  = send;