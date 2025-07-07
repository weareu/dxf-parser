import DxfArrayScanner, { IGroup } from '../DxfArrayScanner.js';
import IGeometry, { IEntity, IPoint } from './geomtry.js';
export interface IMeshEntity extends IEntity {
    vertices: IPoint[];
    faces: number[][];
    edges: number[][];
    vertexCount: number;
    faceCount: number;
    edgeCount: number;
    subdivisionLevel: number;
    extendedDataCodes: {
        code: number;
        value: any;
    }[];
}
export default class Mesh implements IGeometry {
    ForEntityName: "MESH";
    parseEntity(scanner: DxfArrayScanner, curr: IGroup): IEntity;
}
