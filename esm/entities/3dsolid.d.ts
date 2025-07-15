import DxfArrayScanner, { IGroup } from '../DxfArrayScanner.js';
import IGeometry, { IEntity } from './geomtry.js';
interface AcisHeader {
    version: number;
    numRecords: number;
    numEntities: number;
    flags: number;
    productId: string;
    acisVersion: string;
    date: string;
    units: number;
    resabs: number;
    resnor: number;
}
interface Point {
    location: [number, number, number];
}
interface StraightCurve {
    origin: [number, number, number];
    direction: [number, number, number];
}
interface PlaneSurface {
    origin: [number, number, number];
    normal: [number, number, number];
    uDir: [number, number, number];
    vDir: [number, number, number];
    reverseV: boolean;
    uClosed: boolean;
    vClosed: boolean;
    selfIntersect: boolean;
}
interface Vertex {
    point: Point | null;
}
interface Edge {
    startVertex: Vertex | null;
    endVertex: Vertex | null;
    curve: StraightCurve | null;
    sense: boolean;
    startParam?: number;
    endParam?: number;
}
interface Coedge {
    edge: Edge | null;
    sense: boolean;
    partner: Coedge | null;
    next: Coedge | null;
    prev: Coedge | null;
}
interface Loop {
    coedges: Coedge[];
}
interface Face {
    loops: Loop[];
    surface: PlaneSurface | null;
    sense: boolean;
    doubleSided: boolean;
}
interface Shell {
    faces: Face[];
}
interface Lump {
    shells: Shell[];
}
interface Body {
    lumps: Lump[];
}
export interface I3DSolidEntity extends IEntity {
    modelerFormatVersion: number;
    hasSolidHistory: boolean;
    proprietaryData: string[];
    additionalProprietaryData: string[];
    historyObjectHandle: string;
    acisData: string;
    acisHeader: AcisHeader | null;
    body: Body | null;
    parseError?: string;
}
export default class Solid3d implements IGeometry {
    ForEntityName: "3DSOLID";
    parseEntity(scanner: DxfArrayScanner, curr: IGroup): IEntity;
    private parseAcisDataStreaming;
    private tokenizeLine;
    private parseHeader;
    private resolveBody;
    private resolveLump;
    private resolveShell;
    private resolveFace;
    private resolveLoop;
    private resolveCoedge;
    private resolveEdge;
    private resolveVertex;
    private resolvePoint;
    private resolveCurve;
    private resolveSurface;
}
export {};
