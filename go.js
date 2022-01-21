"use strict";

const _ = require('underscore');

function RedoMove(board, player, move, SIZE) {
    const stat = analyze(board, SIZE);
    _.each([1, -1, SIZE, -SIZE], function(dir) {
        let p = navigate(move, dir, SIZE);
        if (p < 0) return;
        let ix = stat.map[p];
        if (_.isUndefined(ix)) return;
        if (stat.res[ix].type == 0) return;
        if (stat.res[ix].type == player) return;
        if (stat.res[ix].dame.length > 1) return;
        _.each(stat.res[ix].group, function (q) {
            board[q] = 0;
        });
    });
    board[move] = player;
    return board;
}


function analyze(board, SIZE) {
    let m = []; let r = []; let done = [];
    for (let p = 0; p < SIZE * SIZE; p++) {
        if (!isEmpty(board[p])) continue;
        if (_.indexOf(done, p) >= 0) continue;
        let g = [p]; let c = null; let e = [];
        for (let i = 0; i < g.length; i++) {
            m[ g[i] ] = r.length;
            done.push(g[i]);
            _.each([1, -1, SIZE, -SIZE], function(dir) {
                let q = navigate(g[i], dir, SIZE);
                if (q < 0) return;
                if (_.indexOf(g, q) >= 0) return;
                if (isEnemy(board[q])) {
                    if (c === null) c = -1;
                    if (isFriend(c)) c = 0;
                    if (_.indexOf(e, q) < 0) e.push(q);
                    return;
                }
                if (isFriend(board[q])) {
                    if (c === null) c = 1;
                    if (isEnemy(c)) c = 0;
                    if (_.indexOf(e, q) < 0) e.push(q);
                    return;
                }
                g.push(q);
            });
        }
        r.push({
            type:  0,
            group: g,
            color: c,
            edge:  e
        });
    }
    for (let p = 0; p < SIZE * SIZE; p++) {
        if (_.indexOf(done, p) >= 0) continue;
        let f = isFriend(board[p]);
        let g = [p]; let d = []; let y = []; let e = [];
        for (let i = 0; i < g.length; i++) {
            m[ g[i] ] = r.length;
            done.push(g[i]);
            _.each([1, -1, SIZE, -SIZE], function(dir) {
                let q = navigate(g[i], dir, SIZE);
                if (q < 0) return;
                if (_.indexOf(g, q) >= 0) return;
                if (isFriend(board[q])) {
                    if (!f) {
                        if (_.indexOf(e, q) < 0) e.push(q);
                        return;
                    } else {
                        if (_.indexOf(g, q) < 0) g.push(q);
                    }
                } else if (isEnemy(board[q])) {
                    if (f) {
                        if (_.indexOf(e, q) < 0) e.push(q);
                        return;
                    } else {
                        if (_.indexOf(g, q) < 0) g.push(q);
                    }
                } else {
                    if (_.indexOf(d, q) < 0) d.push(q);
                    let ix = m[q];
                    if (_.isUndefined(ix)) return;
                    if (!isEmpty(r[ix].type)) return;
                    if (f) {
                        if (isFriend(r[ix].color)) {
                            if (_.indexOf(y, q) < 0) y.push(q);
                            r[ix].isEye = true;
                        }
                    } else {
                        if (isEnemy(r[ix].color)) {
                            if (_.indexOf(y, q) < 0) y.push(q);
                            r[ix].isEye = true;
                        }
                    }
                }
            });
        }
        r.push({
            type:  f ? 1 : -1,
            group: g,
            dame:  d,
            eyes:  y,
            edge:  e
        });
    }
    return {
        map: m,
        res: r
    }
}

function flipX(pos, SIZE) {
    const x = pos % SIZE;
    pos -= x;
    return pos + (SIZE - x - 1);
}

function flipY(pos, SIZE) {
    const y = (pos / SIZE) | 0;
    pos -= y * SIZE;
    return (SIZE - y - 1) * SIZE + pos;
}

function toRight(pos, SIZE) {
    const x = pos % SIZE;
    const y = (pos / SIZE) | 0;
    return x * SIZE + (SIZE - y - 1);
}

function toLeft(pos, SIZE) {
    const x = pos % SIZE;
    const y = (pos / SIZE) | 0;
    return (SIZE - x - 1) * SIZE + y;
}

function transform(pos, n, SIZE) {    
    switch (n) {
        case 1:
            pos = flipX(pos, SIZE);
            break;
        case 2:
            pos = flipY(pos, SIZE);
            break;
        case 3:
            pos = flipX(pos, SIZE);
            pos = flipY(pos, SIZE);
            break;
        case 4:
            pos = toRight(pos, SIZE);
            break;
        case 5:
            pos = toLeft(pos, SIZE);
            break;
        case 6:
            pos = toRight(pos, SIZE);
            pos = flipX(pos, SIZE);
            break;
        case 7:
            pos = toLeft(pos, SIZE);
            pos = flipX(pos, SIZE);
            break;
        case 8:
            pos = flipX(pos, SIZE);
            pos = toLeft(pos, SIZE);
            break;
        case 9:
            pos = flipX(pos, SIZE);
            pos = toRight(pos, SIZE);
            break;
    }
    return pos;
}

function GetFen(board, SIZE, inverse, rotate) {
    let r = "";

    for (let row = 0; row < SIZE; row++) {
        if (row != 0) r += '/';
        let empty = 0;
        for (let col = 0; col < SIZE; col++) {
            const pos = transform(row * SIZE + col, rotate, SIZE);
            const piece = board[pos];
            if (isEmpty(piece)) {
                if (empty > 8) {
                    r += empty;
                    empty = 0;
                }
                empty++;
            }
            else {
                if (empty != 0) 
                    r += empty;
                empty = 0;
                if (isFriend(piece)) {
                    r += inverse ? 'w' : 'b';
                } else {
                    r += inverse ? 'b' : 'w';
                }
            }
        }
        if (empty != 0) {
            r += empty;
        }
    }
    
    return r;
}

function isFriend(x) {
    return x > 0.1;
}

function isEnemy(x) {
    return x < -0.1;
}

function isEmpty(x) {
    return !isFriend(x) && !isEnemy(x);
}

function navigate(pos, dir, SIZE) {
    let r = +pos + +dir;
    if (r >= SIZE * SIZE) return -1;
    if ((dir > -2) && (dir < 2)) {
        if (((pos / SIZE) | 0) != ((r / SIZE) | 0)) return -1;
    }
    return r;
}

module.exports.GetFen = GetFen;
module.exports.RedoMove = RedoMove;
module.exports.transform = transform;
