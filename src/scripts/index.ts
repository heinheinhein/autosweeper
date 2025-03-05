import { Mijnveger } from "./mijnveger";
import { Brein, Move } from "./brein";
import { Cursor } from "./cursor";
import "../styles/index.css";
import "../styles/mijnveger.css";
import "../styles/cursor.css";

let mijnveger: Mijnveger;
let brein: Brein;
let cursor: Cursor;
let move: Move | null;

const delay = 100;
const mijnvegerElement = document.getElementById("mijnveger") as HTMLDivElement;
let width = Math.ceil(innerWidth / 16);
let height = Math.ceil(innerHeight / 16);

function init() {
    mijnveger = new Mijnveger({
        element: mijnvegerElement,
        width: width,
        height: height,
        numberOfMines: Math.floor((width * height) / (480 / 99))
    });

    mijnveger.addEventListener("gamewon", () => {
        setTimeout(mijnveger.reset, 10e3);
    });

    mijnveger.addEventListener("gameover", () => {
        setTimeout(mijnveger.reset, 5e3);
    });

    brein = new Brein(mijnveger);
    cursor = new Cursor(delay);

    setInterval(play, 100);

    window.addEventListener("resize", onResize);
}

function play() {
    if (move) {
        if (move.type === "mine") mijnveger.rightClick(move.index);
        if (move.type === "reveal") mijnveger.leftClick(move.index);
    }

    if (mijnveger.isFinished()) {
        move = null;
        return;
    }
    move = brein.act();

    const pos = mijnveger.getCellPosition(move.index);
    cursor.move(pos.x, pos.y);
}

function onResize() {
    move = null;
    mijnvegerElement.replaceChildren();

    width = Math.ceil(innerWidth / 16);
    height = Math.ceil(innerHeight / 16);

    mijnveger = new Mijnveger({
        element: mijnvegerElement,
        width: width,
        height: height,
        numberOfMines: Math.floor((width * height) / (480 / 99))
    });

    brein = new Brein(mijnveger);
}

init();
