import { Mijnveger } from "./mijnveger";

export type Move = {
    type: "reveal" | "mine";
    index: number;
};

export class Brein {
    private mijnveger: Mijnveger;
    private moveQueue: Move[];

    private field!: number[];
    private unrevealedTiles!: number[];
    private numberTiles!: number[];
    private flagTiles: number[] = [];

    private clickedTiles: number[] = [];
    private outplayedNumberTiles: number[] = [];

    private previousMove: Move | undefined;

    constructor(mijnveger: Mijnveger) {
        this.mijnveger = mijnveger;
        this.mijnveger.addEventListener("reset", this.reset);

        this.see();
        this.moveQueue = [this.generateRandomMove()];
    }

    private generateRandomMove = (): Move => {
        const unrevealedTiles = this.getUnrevealedTiles();
        const index = unrevealedTiles[Math.floor(Math.random() * unrevealedTiles.length)];
        return { type: "reveal", index };
    };

    private getUnrevealedTiles = (): number[] => {
        const tiles: number[] = [];

        this.field.forEach((value, index) => {
            if (value === -1) tiles.push(index);
        });

        return tiles;
    };

    private getNumberTiles = (): number[] => {
        const tiles: number[] = [];

        this.field.forEach((value, index) => {
            if (value > 0) tiles.push(index);
        });

        return tiles;
    };

    private getFlagTiles = (): number[] => {
        const tiles: number[] = [];

        this.mijnveger.getFlags().forEach((value, index) => {
            if (value) tiles.push(index);
        });

        return tiles;
    };

    private see = (): void => {
        this.field = this.mijnveger.getField();
        this.unrevealedTiles = this.getUnrevealedTiles();
        this.numberTiles = this.getNumberTiles();
        this.flagTiles = this.getFlagTiles();
    };

    private think = (): void => {
        this.see();
        for (let i = 0; i < this.numberTiles.length; i++) {
            const index = this.numberTiles[i];

            // als dit nummer geen onthulbare buren meer heeft skippen we deze loop (is heel goed voor performance op firefox)
            if (this.outplayedNumberTiles.includes(index)) continue;

            const kernelIndices = this.mijnveger.determineKernelIndices(index, false);
            const unrevealedNeighbors = kernelIndices.filter((value) => this.unrevealedTiles.includes(value));
            const flagNeighbors = kernelIndices.filter((value) => this.flagTiles.includes(value));

            // als het aantal verhulde vakjes hetzelfde is als het cijfer op dit vakje
            if (unrevealedNeighbors.length === this.field[index]) {
                // markeer dan de verhulde vakjes als mines
                unrevealedNeighbors.forEach((value) => {
                    // check of ze niet al een mine bevatten
                    if (!this.clickedTiles.includes(value)) {
                        this.moveQueue.push({ type: "mine", index: value });
                        this.clickedTiles.push(value);
                    }
                });
            }

            // als het aantal vlaggetjes hetzelfde is als het cijfer op dit vakje
            if (flagNeighbors.length === this.field[index]) {
                // en als er nog niet onthulde vakjes zijn
                const flaglessUnrevealedNeighbors = unrevealedNeighbors.filter((value) => !this.flagTiles.includes(value));
                if (flaglessUnrevealedNeighbors.length > 0) {
                    flaglessUnrevealedNeighbors.forEach((value) => {
                        if (!this.clickedTiles.includes(value)) {
                            this.moveQueue.push({ type: "reveal", index: value });
                            this.clickedTiles.push(value);
                        }
                    });
                } else {
                    // als alle vakjes om dit nummer onthult zijn hebben we niks meer aan dit vakje, voeg de index toe aan outplayedNumberTiles zodat er niet meer over nagedacht wordt
                    this.outplayedNumberTiles.push(index);
                }
            }
        }
    };

    // evalueer of de moves in de queue daadwerkelijk nieuwe vakjes gaan onthullen
    // deze functie haalt moves die niks doen uit de queue
    private considerMove = (move: Move): boolean => {
        this.see();

        // is nuttige move als een flag geplaats wordt, als er een weg wordt gehaald is het geen nuttige move
        if (move.type === "mine") {
            return !this.flagTiles.includes(move.index);
        }

        // als er wordt geklikt op een unrevealed tile waar geen flag op staat is het een nuttige move
        if (this.unrevealedTiles.includes(move.index) && !this.flagTiles.includes(move.index)) {
            return true;
        }

        // als er wordt geklikt op een cijfer tile,
        if (this.numberTiles.includes(move.index)) {
            const kernelIndices = this.mijnveger.determineKernelIndices(move.index, false);

            // moeten er flagloze unrevealed tiles naast zitten
            const flaglessUnrevealedNeighbors = kernelIndices.filter((value) => this.unrevealedTiles.includes(value) && !this.flagTiles.includes(value));
            if (flaglessUnrevealedNeighbors.length === 0) return false;

            // en moet het aantal flags kloppen
            const flagNeighbors = kernelIndices.filter((value) => this.flagTiles.includes(value));
            if (flagNeighbors.length === this.field[move.index]) return true;
        }

        return false;
    };

    // voer de eerstvolgende move uit in de queue
    public act = (): Move => {
        this.think();
        this.sortMoves();

        let move: Move = this.moveQueue[0] ? this.moveQueue[0] : this.educatedGuess();

        // als de aankomende move niet nuttig is, halen we we deze weg uit de queue tot dat we er een vinden die wel nuttig is
        while (!this.considerMove(move)) {
            this.moveQueue.shift();
            move = this.moveQueue[0] ? this.moveQueue[0] : this.educatedGuess();
        }

        this.previousMove = move;

        this.moveQueue.shift();
        return move;
    };

    // kies het vakje om op te klikken met de laagste kans om een mine te zijn
    private educatedGuess = (): Move => {
        this.see();

        let bestOdds = 1;
        let chosenIndex!: number;
        const unrevealedTilesWithOdds: { [index: number]: number } = {};

        this.numberTiles.forEach((index) => {
            // bereken hoe groot de kans is dat een klikbaar omliggend vakje een mijn bevat
            const kernelIndices = this.mijnveger.determineKernelIndices(index, false);
            const surroundingFlags = kernelIndices.filter((value) => this.flagTiles.includes(value));
            const flaglessUnrevealedNeighbors = kernelIndices.filter((value) => this.unrevealedTiles.includes(value) && !this.flagTiles.includes(value));

            // kan NaN zijn als er geen vakjes te onthullen zijn en er gedeeld wordt door nul
            const odds = (this.field[index] - surroundingFlags.length) / flaglessUnrevealedNeighbors.length;
            if (!isNaN(odds)) {
                flaglessUnrevealedNeighbors.forEach((value) => {
                    // zet deze odds voor het vakje als er nog geen odds voor dit vakje is of als deze odds hoger is dan de huidige odds
                    if (!(value in unrevealedTilesWithOdds) || odds > unrevealedTilesWithOdds[value]) {
                        unrevealedTilesWithOdds[value] = odds;
                    }
                });
            }
        });

        // pak de index met de laagste odds
        Object.keys(unrevealedTilesWithOdds).forEach((indexString) => {
            const index = parseInt(indexString);
            const odds = unrevealedTilesWithOdds[index];

            if (odds < bestOdds) {
                bestOdds = odds;
                chosenIndex = index;
            }
        });

        return { type: "reveal", index: chosenIndex };
    };

    // sorteer de moves zodat deze zo dicht mogelijk bij previousmove liggen
    private sortMoves = (): void => {
        if (!this.previousMove) this.previousMove = this.moveQueue[0];
        const previousPosition = this.mijnveger.getCellPosition(this.previousMove.index);

        this.moveQueue.sort((a, b) => {
            const aPosition = this.mijnveger.getCellPosition(a.index);
            const bPosition = this.mijnveger.getCellPosition(b.index);

            const aRelativePosition = { x: aPosition.x - previousPosition.x, y: aPosition.y - previousPosition.y };
            const bRelativePosition = { x: bPosition.x - previousPosition.x, y: bPosition.y - previousPosition.y };

            const aDistance = Math.sqrt(aRelativePosition.x ** 2 + aRelativePosition.y ** 2);
            const bDistance = Math.sqrt(bRelativePosition.x ** 2 + bRelativePosition.y ** 2);

            return aDistance - bDistance;
        });
    };

    private reset = (): void => {
        this.see();
        this.moveQueue = [this.generateRandomMove()];
        this.clickedTiles = [];
        this.outplayedNumberTiles = [];
        this.previousMove = undefined;
    };
}
