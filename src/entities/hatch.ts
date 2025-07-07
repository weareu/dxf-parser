import DxfArrayScanner, { IGroup } from '../DxfArrayScanner.js';
import * as helpers from '../ParseHelpers.js';
import IGeometry, { IEntity } from './geomtry.js';

// Interface for 2D points to match test expectations
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
  public ForEntityName = 'HATCH' as const;

  public parseEntity(scanner: DxfArrayScanner, curr: IGroup): IEntity {
    const entity: IHatchEntity = {
      type: curr.value as string,
      boundaries: [],
      solidFill: false,
      associativity: false,
      boundaryPathsCount: 0,
      annotatedBoundary: true,
      seedPointsCount: 0,
      style: 0,
      patternStyle: 1,
      elevationX: 0,
      elevationY: 0,
      elevationZ: 0,
      extrusionDirectionX: 0,
      extrusionDirectionY: 0,
      extrusionDirectionZ: 1,
      pixelSize: 0,
      layer: '',
      colorIndex: 0,
      lineType: '',
      lineTypeScale: 1,
      visible: true,
      handle: 0,
      color: 0,
      inPaperSpace: false,
      ownerHandle: '',
      materialObjectHandle: 0,
      lineweight: -3,
      extendedData: { customStrings: [], applicationName: '' },
    };

    curr = scanner.next();
    while (!scanner.isEOF()) {
      if (curr.code === 0) break;

      switch (curr.code) {
        case 2: // Pattern name
          entity.patternName = curr.value as string;
          break;
        case 5: // Handle (override to ensure string)
          entity.handle = curr.value as number;
          break;
        case 10: // Elevation point X
          entity.elevationX = curr.value as number;
          break;
        case 20: // Elevation point Y
          entity.elevationY = curr.value as number;
          break;
        case 30: // Elevation point Z
          entity.elevationZ = curr.value as number;
          break;
        case 41: // Pattern scale
          entity.patternScale = curr.value as number;
          break;
        case 47: // Pixel size
          entity.pixelSize = curr.value as number;
          break;
        case 70: // Solid fill flag
          entity.solidFill = curr.value === 1;
          break;
        case 71: // Associativity flag
          entity.associativity = curr.value === 1;
          break;
        case 73: // Boundary annotation flag
          entity.annotatedBoundary = curr.value === 1;
          break;
        case 75: // Hatch style
          entity.style = curr.value as number;
          break;
        case 76: // Hatch pattern type
          entity.patternStyle = curr.value as number;
          break;
        case 91: // Number of boundary paths
          entity.boundaryPathsCount = curr.value as number;
          entity.boundaries = [];
          break;
        case 93: // Number of vertices in boundary
          const boundaryVerticesCount = curr.value as number;
          const boundary = this.parseHatchVertices(boundaryVerticesCount, scanner);
          entity.boundaries.push(boundary);
          curr = scanner.lastReadGroup!;
          break;
        case 98: // Number of seed points
          entity.seedPointsCount = curr.value as number;
          break;
        case 210: // Extrusion direction X
          entity.extrusionDirectionX = curr.value as number;
          break;
        case 220: // Extrusion direction Y
          entity.extrusionDirectionY = curr.value as number;
          break;
        case 230: // Extrusion direction Z
          entity.extrusionDirectionZ = curr.value as number;
          break;
        case 1000: // Extended data application name
          entity.extendedData.applicationName = curr.value as string;
          break;
        case 1001: // Extended data custom strings
          entity.extendedData.customStrings.push(curr.value as string);
          break;
        default:
          helpers.checkCommonEntityProperties(entity, curr, scanner);
          break;
      }
      curr = scanner.next();
    }

    return entity;
  }

  private parseHatchVertices(n: number, scanner: DxfArrayScanner): IPoint2D[] {
    if (!n || n <= 0) throw new Error('n must be greater than 0 vertices');
    const vertices: IPoint2D[] = [];
    let vertexIsStarted = false;
    let vertexIsFinished = false;
    let curr = scanner.next();

    for (let i = 0; i < n; i++) {
      const vertex: IPoint2D = { x: 0, y: 0 };
      while (!scanner.isEOF()) {
        if (curr.code === 0 || vertexIsFinished) break;

        switch (curr.code) {
          case 10: // X
            if (vertexIsStarted) {
              vertexIsFinished = true;
              continue;
            }
            vertex.x = curr.value as number;
            vertexIsStarted = true;
            break;
          case 20: // Y
            vertex.y = curr.value as number;
            break;
          case 42: // Bulge
            if (curr.value !== 0) vertex.bulge = curr.value as number;
            break;
          default:
            if (vertexIsStarted) {
              vertices.push(vertex);
            }
            scanner.rewind();
            return vertices;
        }
        curr = scanner.next();
      }
      vertices.push(vertex);
      vertexIsStarted = false;
      vertexIsFinished = false;
    }
    scanner.rewind();
    return vertices;
  }
}