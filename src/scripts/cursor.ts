import cursorImage from "../images/cursor.png";

export class Cursor {
    private element: HTMLImageElement;

    constructor(delay: number) {
        this.element = document.createElement("img");
        this.element.src = cursorImage;
        this.element.classList.add("cursor");
        this.element.style.transitionDuration = `${delay}ms`;
        this.move(Math.round(innerWidth / 2), Math.round(innerHeight / 2));

        document.body.appendChild(this.element);
    }

    public move = (x: number, y: number): void => {
        this.element.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
    };
}
