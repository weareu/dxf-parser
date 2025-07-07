import DxfArrayScanner, { IGroup } from '../DxfArrayScanner.js';
import IGeometry, { IEntity } from './geomtry.js';
interface IPoint2D {
    x: number;
    y: number;
    bulge?: number;
}
export interface IHatchEntity extends IEntity {
    patternName?: string;
    solidFill: boolean;
    patternScale?: number;
    patternAngle?: number;
    boundaries: Array<Array<IPoint2D>>;
    associativity: boolean;
    boundaryPathsCount: number;
    annotatedBoundary: boolean;
    seedPointsCount: number;
    style: number;
    patternStyle: number;
    elevationX: number;
    elevationY: number;
    elevationZ: number;
    extrusionDirectionX: number;
    extrusionDirectionY: number;
    extrusionDirectionZ: number;
    pixelSize?: number;
}
export default class Hatch implements IGeometry {
    ForEntityName: "HATCH";
    parseEntity(scanner: DxfArrayScanner, curr: IGroup): IEntity;
    private parseHatchVertices;
}
export {};
