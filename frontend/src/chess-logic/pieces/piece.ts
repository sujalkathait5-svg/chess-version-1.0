import { Color, FENChar } from "../models";
import type { Coords } from "../models";

export abstract class Piece {
    protected abstract _FENChar: FENChar;
    protected abstract _directions: Coords[];

    private _color: Color;

    constructor(color: Color) {
        this._color = color;
    }

    public get FENChar(): FENChar {
        return this._FENChar;
    }

    public get directions(): Coords[] {
        return this._directions;
    }

    public get color(): Color {
        return this._color;
    }
}