"use strict";

const sgf = require('./parser');
const go = require('./go');

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const _ = require('underscore');

const SERVICE = 'https://games.dtco.ru';
const abc = 'abcdefghijklmnopqrs';

function move(s, SIZE) {
    return _.indexOf(abc, s[0]) + _.indexOf(abc, s[1]) * SIZE;
}

function put(setup, move) {
    axios.put(SERVICE + '/api/ai/fit', {
        variant_id: 2,
        setup: setup,
        move: move
    })
    .then(function (response) {
        console.log(response.data);
      })
      .catch(function (error) {
        console.log('ERROR: ' + error);
    });
}

function loadFiles(dir) {
    const files = fs.readdirSync(dir).map(fileName => {
        return path.join(dir, fileName);
    });
    _.each(files, function(name) {
        fs.readFile(name, (e, d) => {
            if (e) {
              console.error(e);
              return;
            }
            const data = d.toString();
            const moves = sgf.parse(data);
            let SIZE = 19;    

            if (moves) {
                let board = new Int32Array(SIZE * SIZE);
                for (let i = 0; i < moves.length; i++) {
                    if (moves[i].name == 'SZ') {
                        SIZE = moves[i].arg[0];
                        board = new Int32Array(SIZE * SIZE);
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
                        const s = go.GetFen(board, SIZE, true);
                        const p = '?turn=0;&setup=';
                        put(p + s, m);
                        board = go.RedoMove(board, 1, m, SIZE);
                    }
                    if (moves[i].name == 'W') {
                        const m = move(moves[i].arg[0], SIZE);
                        const s = go.GetFen(board, SIZE, false);
                        const p = '?turn=1;&setup=';
                        put(p + s, m);
                        board = go.RedoMove(board, -1, m, SIZE);
                    }
                }
            }
        })        
    });
}

loadFiles('./data');