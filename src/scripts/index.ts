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

const delay = 100,
    mijnvegerElement = document.getElementById("mijnveger") as HTMLDivElement,
    width = Math.ceil(innerWidth / 16),
    height = Math.ceil(innerHeight / 16);

mijnveger = new Mijnveger({
    element: mijnvegerElement,
    width: width,
    height: height,
    numberOfMines: Math.floor((width * height) / (480 / 99))
});

mijnveger.addEventListener("gamewon", () => {
    setTimeout(restart, 10e3);
});

mijnveger.addEventListener("gameover", () => {
    setTimeout(restart, 5e3);
});

brein = new Brein(mijnveger);
cursor = new Cursor(delay);

play();

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
    setTimeout(play, delay);
}

function restart() {
    mijnveger.reset();
    setTimeout(play, 200);
}
