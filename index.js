"use strict";

const sgf = require('./parser');
const go = require('./go');
const ml = require('./ml');

const fs = require('fs');
const path = require('path');
const _ = require('underscore');

const abc = 'abcdefghijklmnopqrs';

let SIZE   = 19;    
let once   = true;
let boards = [];
let ix     = 0;

function move(s, SIZE) {
    return _.indexOf(abc, s[0]) + _.indexOf(abc, s[1]) * SIZE;
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
//                      console.log('WINNER = ' + WINNER);
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
//                              console.log(s);
//                              if (ml.send(s, go.transform(m, rotate, SIZE), SIZE)) isDone = true;
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
//                              console.log(s);
//                              if (ml.send(s, go.transform(m, rotate, SIZE), SIZE)) isDone = true;
                            });
                        }
                        board = go.RedoMove(board, -1, m, SIZE);
                    }
                }
            }
        })        
    });
}

function exec() {
    if (once) {
        ml.init();
        once = false;
        return true;
    }
    if (ml.ready()) {
//      console.log('*** Ready *** ' + (boards.length - ix));
        for (let i = 0; i < boards.length; i++) {
            ml.send(boards[ix].setup, boards[ix].move, SIZE);
            ix++;
        }
        return true;
    }
    return true;
}

let run = function() {
    if (exec()) {
        setTimeout(run, 1000);
    }
}

loadFiles('./data');
run();
