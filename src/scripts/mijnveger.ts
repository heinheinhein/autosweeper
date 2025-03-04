export class Mijnveger extends EventTarget {
    private element: HTMLDivElement;
    private width: number;
    private height: number;
    private numberOfMines: number;

    private numberOfCells: number;
    private mines: boolean[];
    private flags: boolean[];
    private discovered: boolean[];
    private neighboringMines: (number | false)[];
    private cellElements: HTMLDivElement[];
    private isPlayable: boolean = false;
    private firstClick: boolean = false;

    /**
     * Initializes a new instance of the Mijnveger class.
     * @param params The parameters for initializing the game.
     * @param params.element The element containing the cells.
     * @param params.width The width of the game board.
     * @param params.height The height of the game board.
     * @param params.numberOfMines The number of mines on the board.
     */
    constructor({ element, width, height, numberOfMines }: { element: HTMLDivElement; width: number; height: number; numberOfMines: number }) {
        super();

        this.element = element;
        this.height = height;
        this.width = width;
        this.numberOfMines = numberOfMines;

        // Prevent right-click from doing anything on the minesweeper board
        this.element.addEventListener("contextmenu", (event) => event.preventDefault());

        this.numberOfCells = width * height;

        if (this.numberOfMines > this.numberOfCells - 9) {
            this.numberOfMines = this.numberOfCells - 9;
            console.warn(`numberOfMines is higher than the maximum possible spaces on the board. numberOfMines is set to ${this.numberOfMines} instead.`);
        }

        this.mines = Array(this.numberOfCells).fill(false);
        this.flags = Array(this.numberOfCells).fill(false);
        this.discovered = Array(this.numberOfCells).fill(false);
        this.neighboringMines = [];
        this.cellElements = [];

        this.createCells();

        this.firstClick = true;
        this.isPlayable = true;
    }

    /**
     * Creates the game board with clickable cells.
     */
    private createCells = (): void => {
        let cellIndex = 0;

        for (let i = 0; i < this.height; i++) {
            const row = document.createElement("div");
            row.classList.add("row");

            for (let j = 0; j < this.width; j++) {
                const cell = document.createElement("div");

                cell.dataset.cellIndex = cellIndex.toString();
                cell.classList.add("cell");
                cell.addEventListener("click", this.onLeftClick);
                cell.addEventListener("contextmenu", this.onRightClick);
                this.cellElements.push(cell);
                row.appendChild(cell);

                cellIndex++;
            }

            this.element.appendChild(row);
        }
    };

    /**
     * Handles the left-click event on a cell from an event listener, extracts the index from the clicked element and calls leftClick.
     * @param event The click event.
     */
    private onLeftClick = (event: MouseEvent): void => {
        if (!this.isPlayable) return;

        // if (Math.random() < .002) this.jumpscare();

        if (!(event.target instanceof HTMLDivElement)) return;
        if (!event.target.dataset.cellIndex) return;
        const clickedIndex = parseInt(event.target.dataset.cellIndex);

        this.leftClick(clickedIndex);
    };

    /**
     * Handles the left-click on a cell, revealing the cell or the surrounding cells.
     * @param cellIndex The index that is clicked on.
     */
    public leftClick = (cellIndex: number): void => {
        if (!this.isPlayable) return;

        // If you click on a flag, nothing happens
        if (this.flags[cellIndex]) return;

        // If it is the first click, determine where the mines are located depending on where the click was made
        if (this.firstClick) {
            this.firstClick = false;

            this.generateMines(cellIndex);
            this.precalculateNeighboringMines();
        }

        // If the cell is already discovered and has at least 1 mine next to it, check if it is saturated with the number of flags around it to reveal more cells
        if (this.discovered[cellIndex] && this.neighboringMines[cellIndex]) return this.revealAdditionalCells(cellIndex);

        // Otherwise, reveal this cell
        return this.revealCell(cellIndex);
    };

    /**
     * Handles the right-click event on a cell from an event listener, extracts the index from the clicked element and calls rightClick.
     * @param event The right-click event.
     */
    private onRightClick = (event: MouseEvent): void => {
        // Prevent context menu
        event.preventDefault();

        if (!this.isPlayable) return;

        // if (Math.random() < .002) this.jumpscare();

        if (!(event.target instanceof HTMLDivElement)) return;
        if (!event.target.dataset.cellIndex) return;

        const clickedIndex = parseInt(event.target.dataset.cellIndex);

        this.rightClick(clickedIndex);
    };

    /**
     * Handles the right-click on a cell, toggling a flag on or off.
     * @param cellIndex The index that is clicked on.
     */
    public rightClick = (cellIndex: number): void => {
        if (!this.isPlayable) return;

        // If it is a discovered cell, do nothing
        if (this.discovered[cellIndex]) return;

        // Toggle the flag class on the clicked cell and add/remove it to/from the flags list
        this.flags[cellIndex] = !this.flags[cellIndex];
        this.cellElements[cellIndex].classList.toggle("flag");

        // Update the flag counter
        this.updateNumberOfFlags();
    };

    /**
     * Generates the mines on the board, ensuring that the first clicked cell and its surrounding cells are not mines.
     * @param clickedIndex The index of the first clicked cell.
     */
    private generateMines = (clickedIndex: number): void => {
        // Determine how many cells can have mines, depending on whether the click is on the edge of the board
        let numberOfCellsToGenerate = this.numberOfCells - 9;
        if (clickedIndex < this.width || clickedIndex > this.numberOfCells - this.width) numberOfCellsToGenerate += 3;
        if ((clickedIndex + 1) % this.width === 0 || clickedIndex % this.width === 0) numberOfCellsToGenerate += 3;
        if (numberOfCellsToGenerate === this.numberOfCells - 3) numberOfCellsToGenerate -= 1;

        // Generate a random number for each cell that needs to be generated
        const randomNumbers = Array.from(Array(numberOfCellsToGenerate), () => Math.random());
        // Determine the cutoff number: the number such that the same number of random values fall below it as the number of mines needed
        const cutoffNumber = [...randomNumbers].sort()[this.numberOfMines - 1];

        // Determine which indices should not contain mines (those surrounding the clicked index)
        const kernelIndices = this.determineKernelIndices(clickedIndex, true);

        // Add a 1 to the array with random numbers for the indexes around the clicked index so that this value will not be lower than the cutoffNumber and therefore will not become a mine
        kernelIndices.forEach((neighborIndex) => randomNumbers.splice(neighborIndex, 0, 1));

        // Fill the mines array with the boolean indicating whether the random number at the same position is higher than or equal to the cutoffNumber
        this.mines = this.mines.map((_value, index) => randomNumbers[index] <= cutoffNumber);

        // Emit a game start event
        this.gameStart();
    };

    /**
     * Calculates the amount of neighboring mines for each cell on the board
     */
    private precalculateNeighboringMines = (): void => {
        for (let index = 0; index < this.numberOfCells; index++) {
            // if this cell contains a mine, we don't need to calculate the neighboring mines
            if (this.mines[index]) {
                this.neighboringMines.push(false);
            } else {
                const kernelIndices = this.determineKernelIndices(index, false);
                const neighboringMinesIndices = kernelIndices.filter((i) => this.mines[i]);

                this.neighboringMines.push(neighboringMinesIndices.length);
            }
        }
    };

    /**
     * Reveals the clicked cell. If it is a mine, the game ends.
     * If the cell is not a mine and has no neighboring mines, adjacent cells are also revealed.
     * @param clickedIndex The index of the clicked cell.
     */
    private revealCell = (clickedIndex: number): void => {
        const clickedElement = this.cellElements[clickedIndex];

        // If the cell is a mine, it's game over
        if (this.mines[clickedIndex]) return this.gameOver(clickedElement);

        // If the cell is already discovered, nothing happens
        if (this.discovered[clickedIndex]) return;

        // Remove the flag if it was placed on this cell (is only possible if this square is being revealed by flood-filling an open area)
        if (this.flags[clickedIndex]) {
            clickedElement.classList.remove("flag");
            this.flags[clickedIndex] = false;
            this.updateNumberOfFlags();
        }

        // Mark this cell as discovered
        this.discovered[clickedIndex] = true;

        // Style the element as a discovered cell
        clickedElement.classList.add("discovered");

        const numberOfNeighboringMines = this.neighboringMines[clickedIndex];
        // if the numberOfNeighboringMines is false, a mine is clicked on. this shouldn't be possible seeing as that is the first check in this function
        if (numberOfNeighboringMines === false) return this.gameOver(clickedElement);

        // If there are mines next to this cell, give this cell the appropriate class
        if (numberOfNeighboringMines > 0) {
            const numberOfMinesClasses = ["one", "two", "three", "four", "five", "six", "seven", "eight"];
            clickedElement.classList.add(numberOfMinesClasses[numberOfNeighboringMines - 1]);
        }

        // If all cells without a mine are discovered, the game is over
        if (this.discovered.every((value, index) => this.mines[index] !== value)) return this.gameWon();

        // If there are no mines next to this cell, reveal the directly adjacent cells, if they have not been discovered
        if (numberOfNeighboringMines === 0) {
            // get the adjecent cells that have not been discovered, and reveal them
            const neighboringIndices = this.determineKernelIndices(clickedIndex, false).filter((index) => !this.discovered[index]);

            neighboringIndices.forEach((index) => this.revealCell(index));
        }
    };

    /**
     * Reveals additional cells if the number of neighboring flags equals the number of neighboring mines.
     * @param clickedIndex The index of the clicked cell.
     */
    private revealAdditionalCells = (clickedIndex: number): void => {
        // const neighboringMines = neighboringIndices.filter((index) => this.mines[index]);

        const numberOfNeighboringMines = this.neighboringMines[clickedIndex];

        // If this cell has no neighboring mines (0) or is a mine (false), there's not much to reveal
        if (!numberOfNeighboringMines) return;

        // get the neighboring indices and count the flags
        const neighboringIndices = this.determineKernelIndices(clickedIndex, false);
        const neighboringFlags = neighboringIndices.filter((index) => this.flags[index]);

        // If the number of flags does not match the number of neighboring mines we do nothing
        if (numberOfNeighboringMines !== neighboringFlags.length) return;

        // determine which indices are going to be revealed, as the number of flags matches the amount of mines
        const indicesToReveal = neighboringIndices.filter((index) => !this.flags[index]);

        // get the indices of the neighboring mines
        const neighboringMines = neighboringIndices.filter((index) => this.mines[index]);

        // if the flags are not placed correctly, we make sure that the ones with a mine will be clicked first
        if (!neighboringFlags.every((value, index) => neighboringMines[index] === value))
            indicesToReveal.sort((a, b) => {
                if (this.mines[a] && this.mines[b]) return 0;
                if (this.mines[a]) return -1;
                return 1;
            });

        indicesToReveal.forEach((index) => this.revealCell(index));
    };

    /**
     * Determines the indices of a 3x3 kernel size for a given index.
     * Ensures that the indices are within the board and not outside of it.
     * @param index The index of the cell.
     * @param includeGivenIndex Set to `true` to include the given index in the returned array, set false to not do that.
     * @returns An array of indices corresponding to the neighboring cells, including the index of the given cell.
     */
    public determineKernelIndices = (index: number, includeGivenIndex: boolean): number[] => {
        const indices: number[] = [];

        // checks if the neighboring indices are within the board and not outside of it
        if (index > this.width - 1 && index % this.width !== 0) indices.push(index - this.width - 1); // top left
        if (index > this.width - 1) indices.push(index - this.width); // top middle
        if (index > this.width - 1 && (index + 1) % this.width !== 0) indices.push(index - this.width + 1); // top right

        if (index % this.width !== 0) indices.push(index - 1); // middle left
        if (includeGivenIndex) indices.push(index); // middle middle
        if ((index + 1) % this.width !== 0) indices.push(index + 1); // middle right

        if (index < this.numberOfCells - this.width && index % this.width !== 0) indices.push(index + this.width - 1); // bottom left
        if (index < this.numberOfCells - this.width) indices.push(index + this.width); // bottom middle
        if (index < this.numberOfCells - this.width && (index + 1) % this.width !== 0) indices.push(index + this.width + 1); // bottom right

        return indices;
    };

    /**
     * Emits a gamestart event.
     */
    private gameStart = (): void => {
        const event = new Event("gamestart");
        this.dispatchEvent(event);
    };

    /**
     * Emits a gameover event, reveals all the mines and prevents further playing.
     * @param clickedElement The element which was clicked last.
     */
    private gameOver = (clickedElement: HTMLDivElement): void => {
        this.isPlayable = false;
        this.element.classList.add("unplayable");

        clickedElement.classList.add("wrong");
        // Mark every flag that is not covering a mine
        this.flags.forEach((value, index) => {
            if (value && !this.mines[index]) this.cellElements[index].classList.add("wrong");
        });

        // Add a mine to every mine not covered by a flag
        this.mines.forEach((value, index) => {
            if (value && !this.flags[index]) this.cellElements[index].classList.add("mine");
        });

        const event = new Event("gameover");
        this.dispatchEvent(event);
    };

    /**
     * Emits a gamewon event and prevents further playing.
     */
    private gameWon = (): void => {
        this.isPlayable = false;
        this.element.classList.add("unplayable");

        // Add a flag to every mine
        this.mines.forEach((value, index) => {
            if (value && !this.flags[index]) {
                this.flags[index] = true;
                this.cellElements[index].classList.add("flag");
            }
        });

        this.updateNumberOfFlags();

        const event = new Event("gamewon");
        this.dispatchEvent(event);
    };

    /**
     * Emits the number of placed flags.
     */
    private updateNumberOfFlags = (): void => {
        const event = new CustomEvent("flagupdate", {
            detail: this.flags.filter((value) => value).length
        });
        this.dispatchEvent(event);
    };

    /**
     * Resets the game board allowing the game to be restarted.
     */
    public reset = (): void => {
        // remove styling from cells
        this.cellElements.forEach((element) => (element.classList.value = "cell"));

        this.mines = Array(this.numberOfCells).fill(false);
        this.flags = Array(this.numberOfCells).fill(false);
        this.discovered = Array(this.numberOfCells).fill(false);
        this.neighboringMines = [];

        this.updateNumberOfFlags();

        this.firstClick = true;
        this.isPlayable = true;
        this.element.classList.remove("unplayable");

        this.dispatchEvent(new Event("reset"));
    };

    /**
     * Gets the current state of the game board.
     * @returns A one-dimensional array of the numbers displayed on each cell. -1 for hiddens cells, 0-8 for discovered cells. When 9 is returned something went wrong.
     */
    public getField = (): number[] => {
        return this.discovered.map((value, index) => {
            if (value) {
                return this.neighboringMines[index] !== false ? this.neighboringMines[index] : 9;
            } else {
                return -1;
            }
        });
    };

    /**
     * Gets the current placed flags
     * @returns A one-dimensional array containing `true` if the cell has a flag and `false` if the cell does not have a flag.
     */
    public getFlags = (): boolean[] => {
        return this.flags;
    };

    /**
     * Is the game finished or not?
     * @returns `true` if the game is finished, `false` if it is not.
     */
    public isFinished = (): boolean => {
        return !this.isPlayable;
    };

    /**
     * Get the x and y coordinates of a specific cell displayed on the screen.
     * @param index Index of the cell.
     * @returns An object containing an `x` and `y` value of the center of the cell.
     */
    public getCellPosition = (index: number): { x: number; y: number } => {
        const rect = this.cellElements[index].getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };

    public get _width(): number {
        return this.width;
    }

    public get _height(): number {
        return this.height;
    }
}
