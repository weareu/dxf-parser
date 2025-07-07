import DxfArrayScanner, { IGroup } from '../DxfArrayScanner.js';
import IGeometry, { IEntity, IPoint } from './geomtry.js';
export interface IHelixEntity extends IEntity {
    startPoint: IPoint;
    axisVector: IPoint;
    tangentDirection: IPoint;
    majorRadius: number;
    minorRadius: number;
    numberOfTurns: number;
    turnHeight: number;
    handedness: number;
    constraintType: number;
}
export default class Helix implements IGeometry {
    ForEntityName: "HELIX";
    parseEntity(scanner: DxfArrayScanner, curr: IGroup): IEntity;
}
