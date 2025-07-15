import DxfArrayScanner, { IGroup } from '../DxfArrayScanner.js';
import * as helpers from '../ParseHelpers.js';
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

const replacementTable: { [key: number]: string } = {
  0x20: ' ',
  0x40: '_',
  0x5F: '@',
};
for (let c = 0x41; c <= 0x5F; c++) {
  replacementTable[c] = String.fromCharCode(0x41 + (0x5E - c));
}

function decode(textLines: string[]): string[] {
  function _decode(text: string): string {
    let s = '';
    let skip = false;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (skip) {
        skip = false;
        continue;
      }
      if (replacementTable.hasOwnProperty(c)) {
        s += replacementTable[c];
        skip = (c === 0x5E); // skip space after 'A'
      } else {
        s += String.fromCharCode(c ^ 0x5F);
      }
    }
    return s;
  }
  return textLines.map(_decode);
}

export default class Solid3d implements IGeometry {
  public ForEntityName = '3DSOLID' as const;

  public parseEntity(scanner: DxfArrayScanner, curr: IGroup): IEntity {
    const entity: I3DSolidEntity = {
      type: curr.value as string,
      modelerFormatVersion: 0,
      hasSolidHistory: false,
      proprietaryData: [] as string[],
      additionalProprietaryData: [] as string[],
      historyObjectHandle: '',
      acisData: '',
      acisHeader: null,
      body: null,
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
      extendedData: { customStrings: [] as string[], applicationName: '' },
      parseError: undefined,
    };

    curr = scanner.next();
    while (!scanner.isEOF() && curr.code !== 0) {
      switch (curr.code) {
        case 5:
          entity.handle = parseInt(curr.value as string, 16);
          break;
        case 70:
          entity.modelerFormatVersion = curr.value as number;
          break;
        case 1:
          entity.proprietaryData.push(curr.value as string);
          break;
        case 3:
          entity.additionalProprietaryData.push(curr.value as string);
          break;
        case 290:
          entity.hasSolidHistory = !!curr.value;
          break;
        case 350:
          entity.historyObjectHandle = curr.value as string;
          break;
        case 100:
          break;
        case 1001:
          entity.extendedData.applicationName = curr.value as string;
          curr = scanner.next();
          while (curr.code === 1000 || curr.code === 1070 || curr.code === 1071) {
            entity.extendedData.customStrings.push(curr.value as string);
            curr = scanner.next();
          }
          scanner.rewind();
          break;
        default:
          helpers.checkCommonEntityProperties(entity, curr, scanner);
          break;
      }
      curr = scanner.next();
    }

    // Decode ACIS data
    const proprietaryData = [...entity.proprietaryData, ...entity.additionalProprietaryData];
    try {
      entity.acisData = decode(proprietaryData).join('');
    } catch (error) {
      entity.parseError = `Failed to decode ACIS data: ${error.message}`;
      return entity;
    }

    // Parse ACIS data with streaming
    try {
      this.parseAcisDataStreaming(entity);
    } catch (error) {
      entity.parseError = `Failed to parse ACIS data: ${error.message}`;
      entity.acisHeader = null;
      entity.body = null;
    }

    return entity;
  }

  private parseAcisDataStreaming(entity: I3DSolidEntity) {
    const sat = entity.acisData.trim();
    if (!sat) {
      entity.parseError = 'Empty ACIS data';
      return;
    }

    // Split into lines (entities separated by #)
    const lines = sat.split('#').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) {
      entity.parseError = 'No valid ACIS data lines';
      return;
    }

    // Parse header from first line
    try {
      const headerTokenGen = this.tokenizeLine(lines[0]);
      entity.acisHeader = this.parseHeader([...headerTokenGen]);
    } catch (error) {
      entity.parseError = `Failed to parse ACIS header: ${error.message}`;
      return;
    }

    // Process each subsequent line as an entity
    const entityMap = new Map<number, any>();
    let index = 0;
    for (let i = 1; i < lines.length; i++) {
      try {
        const tokenGen = this.tokenizeLine(lines[i]);
        const tokens = [...tokenGen];
        if (tokens.length === 0) continue;
        const type = tokens[0] as string;
        const attributes = tokens.slice(1);
        entityMap.set(index, { type, attributes, resolved: null });
        index++;
      } catch (error) {
        console.warn(`Failed to parse entity at index ${i}: ${error.message}`);
        continue;
      }
    }

    // Find body and resolve hierarchy
    const bodyIndex = [...entityMap.entries()].find(([_, e]) => e.type === 'body')?.[0];
    if (bodyIndex === undefined) {
      entity.parseError = 'No body entity found in ACIS data';
      return;
    }

    try {
      entity.body = this.resolveBody(bodyIndex, entityMap, 0);
    } catch (error) {
      entity.parseError = `Failed to resolve body hierarchy: ${error.message}`;
      entity.body = null;
    }
  }

  private *tokenizeLine(line: string): Generator<any, void, undefined> {
    let i = 0;
    while (i < line.length) {
      if (line[i].trim() === '') { i++; continue; }
      if (line[i] === '$') {
        let j = i + 1;
        let sign = 1;
        if (j < line.length && line[j] === '-') { sign = -1; j++; }
        let num = 0;
        while (j < line.length && line[j].match(/\d/)) {
          num = num * 10 + parseInt(line[j]);
          j++;
        }
        yield sign * num;
        i = j;
      } else if (line[i] === '@') {
        let j = i + 1;
        let len = 0;
        while (j < line.length && line[j].match(/\d/)) {
          len = len * 10 + parseInt(line[j]);
          j++;
        }
        i = j;
        // Skip leading spaces after @len
        while (i < line.length && line[i] === ' ') i++;
        const str = line.substring(i, i + len);
        if (str) yield str;
        i += len;
      } else if (line[i] === '{') {
        yield '{';
        i++;
      } else if (line[i] === '}') {
        yield '}';
        i++;
      } else if (line[i].match(/[\d.-]/)) {
        let j = i;
        while (j < line.length && line[j].match(/[\d.eE+-]/)) j++;
        const numStr = line.substring(i, j);
        yield numStr.includes('.') || numStr.toLowerCase().includes('e') ? parseFloat(numStr) : parseInt(numStr);
        i = j;
      } else {
        let j = i;
        while (j < line.length && !line[j].match(/\s|\$|@|\{|\}/)) j++;
        const word = line.substring(i, j).trim();
        if (word) yield word;
        i = j;
      }
    }
  }

  private parseHeader(tokens: any[]): AcisHeader {
    let idx = 0;
    const header: AcisHeader = {
      version: idx < tokens.length ? parseFloat(tokens[idx++]) : 0,
      numRecords: idx < tokens.length ? parseInt(tokens[idx++]) : 0,
      numEntities: idx < tokens.length ? parseInt(tokens[idx++]) : 0,
      flags: idx < tokens.length ? parseInt(tokens[idx++]) : 0,
      productId: idx < tokens.length ? tokens[idx++].toString() : '',
      acisVersion: idx < tokens.length ? tokens[idx++].toString() : '',
      date: idx < tokens.length ? tokens[idx++].toString() : '',
      units: idx < tokens.length ? parseFloat(tokens[idx++]) : 0,
      resabs: idx < tokens.length ? parseFloat(tokens[idx++]) : 0,
      resnor: idx < tokens.length ? parseFloat(tokens[idx++]) : 0,
    };
    return header;
  }

  private resolveBody(index: number, entityMap: Map<number, any>, depth: number): Body | null {
    if (depth > 100) {
      console.warn('Max recursion depth exceeded in resolveBody');
      return null;
    }
    const entry = entityMap.get(index);
    if (!entry) {
      console.warn(`Body index ${index} not found in entityMap`);
      return null;
    }
    if (entry.resolved) return entry.resolved;
    if (entry.type !== 'body') {
      console.warn(`Entity at index ${index} is not a body: ${entry.type}`);
      return null;
    }
    const attrs = entry.attributes;
    if (!attrs || attrs.length < 2) {
      console.warn(`Invalid attributes for body at index ${index}: ${JSON.stringify(attrs)}`);
      return null;
    }
    let lumpPtr = attrs[3] as number; // body attrs: attrs[3] = lump
    const body: Body = { lumps: [] };
    let currentLumpPtr = lumpPtr;
    while (currentLumpPtr >= 0 && currentLumpPtr < entityMap.size) {
      const lumpEntry = entityMap.get(currentLumpPtr);
      if (!lumpEntry || lumpEntry.type !== 'lump') {
        console.warn(`Invalid lump at index ${currentLumpPtr}: ${lumpEntry?.type || 'not found'}`);
        currentLumpPtr = lumpEntry?.attributes[2] || -1;
        continue;
      }
      const lump = this.resolveLump(currentLumpPtr, entityMap, depth + 1);
      if (lump) {
        body.lumps.push(lump);
      } else {
        console.warn(`Failed to resolve lump at index ${currentLumpPtr}`);
      }
      currentLumpPtr = lumpEntry.attributes[2] || -1; // next lump
    }
    if (body.lumps.length === 0) {
      console.warn(`No lumps resolved for body ${index}`);
    }
    entry.resolved = body;
    return body;
  }

  private resolveLump(index: number, entityMap: Map<number, any>, depth: number): Lump | null {
    if (depth > 100) {
      console.warn('Max recursion depth exceeded in resolveLump');
      return null;
    }
    const entry = entityMap.get(index);
    if (!entry) {
      console.warn(`Lump index ${index} not found in entityMap`);
      return null;
    }
    if (entry.resolved) return entry.resolved;
    if (entry.type !== 'lump') {
      console.warn(`Entity at index ${index} is not a lump: ${entry.type}`);
      return null;
    }
    const attrs = entry.attributes;
    if (!attrs || attrs.length < 2) {
      console.warn(`Invalid attributes for lump at index ${index}: ${JSON.stringify(attrs)}`);
      return null;
    }
    let shellPtr = attrs[3] as number;
    const lump: Lump = { shells: [] };
    let currentShellPtr = shellPtr;
    while (currentShellPtr >= 0 && currentShellPtr < entityMap.size) {
      const shellEntry = entityMap.get(currentShellPtr);
      if (!shellEntry || shellEntry.type !== 'shell') {
        console.warn(`Invalid shell at index ${currentShellPtr}: ${shellEntry?.type || 'not found'}`);
        currentShellPtr = shellEntry?.attributes[2] || -1;
        continue;
      }
      const shell = this.resolveShell(currentShellPtr, entityMap, depth + 1);
      if (shell) {
        lump.shells.push(shell);
      } else {
        console.warn(`Failed to resolve shell at index ${currentShellPtr}`);
      }
      currentShellPtr = shellEntry.attributes[2] || -1; // next shell
    }
    if (lump.shells.length === 0) {
      console.warn(`No shells resolved for lump ${index}`);
    }
    entry.resolved = lump;
    return lump;
  }

  private resolveShell(index: number, entityMap: Map<number, any>, depth: number): Shell | null {
    if (depth > 100) {
      console.warn('Max recursion depth exceeded in resolveShell');
      return null;
    }
    const entry = entityMap.get(index);
    if (!entry) {
      console.warn(`Shell index ${index} not found in entityMap`);
      return null;
    }
    if (entry.resolved) return entry.resolved;
    if (entry.type !== 'shell') {
      console.warn(`Entity at index ${index} is not a shell: ${entry.type}`);
      return null;
    }
    const attrs = entry.attributes;
    if (!attrs || attrs.length < 2) {
      console.warn(`Invalid attributes for shell at index ${index}: ${JSON.stringify(attrs)}`);
      return null;
    }
    let facePtr = attrs[3] as number; // first face
    const shell: Shell = { faces: [] };
    let currentFacePtr = facePtr;
    while (currentFacePtr >= 0 && currentFacePtr < entityMap.size) {
      const faceEntry = entityMap.get(currentFacePtr);
      if (!faceEntry || faceEntry.type !== 'face') {
        console.warn(`Invalid face at index ${currentFacePtr}: ${faceEntry?.type || 'not found'}`);
        currentFacePtr = faceEntry?.attributes[2] || -1;
        continue;
      }
      const face = this.resolveFace(currentFacePtr, entityMap, depth + 1);
      if (face) {
        shell.faces.push(face);
      } else {
        console.warn(`Failed to resolve face at index ${currentFacePtr}`);
      }
      currentFacePtr = faceEntry.attributes[2] || -1; // next face
    }
    if (shell.faces.length === 0) {
      console.warn(`No faces resolved for shell ${index}`);
    }
    entry.resolved = shell;
    return shell;
  }

  private resolveFace(index: number, entityMap: Map<number, any>, depth: number): Face | null {
    if (depth > 100) {
      console.warn('Max recursion depth exceeded in resolveFace');
      return null;
    }
    const entry = entityMap.get(index);
    if (!entry) {
      console.warn(`Face index ${index} not found in entityMap`);
      return null;
    }
    if (entry.resolved) return entry.resolved;
    if (entry.type !== 'face') {
      console.warn(`Entity at index ${index} is not a face: ${entry.type}`);
      return null;
    }
    const attrs = entry.attributes;
    if (!attrs || attrs.length < 6) {
      console.warn(`Invalid attributes for face at index ${index}: ${JSON.stringify(attrs)}`);
      return null;
    }
    const loopPtr = attrs[3] as number; // first loop
    const surfacePtr = attrs[4] as number; // surface
    const sense = attrs[5] === 'forward';
    const doubleSided = attrs[6] === 'double';
    const face: Face = {
      loops: [],
      surface: surfacePtr >= 0 ? this.resolveSurface(surfacePtr, entityMap, depth + 1) : null,
      sense,
      doubleSided,
    };
    let currentLoopPtr = loopPtr;
    while (currentLoopPtr >= 0 && currentLoopPtr < entityMap.size) {
      const loopEntry = entityMap.get(currentLoopPtr);
      if (!loopEntry || loopEntry.type !== 'loop') {
        console.warn(`Invalid loop at index ${currentLoopPtr}: ${loopEntry?.type || 'not found'}`);
        currentLoopPtr = loopEntry?.attributes[2] || -1;
        continue;
      }
      const loop = this.resolveLoop(currentLoopPtr, entityMap, depth + 1);
      if (loop) {
        face.loops.push(loop);
      } else {
        console.warn(`Failed to resolve loop at index ${currentLoopPtr}`);
      }
      currentLoopPtr = loopEntry.attributes[2] || -1; // next loop
    }
    if (face.loops.length === 0) {
      console.warn(`No loops resolved for face ${index}`);
    }
    entry.resolved = face;
    return face;
  }

  private resolveLoop(index: number, entityMap: Map<number, any>, depth: number): Loop | null {
    if (depth > 100) {
      console.warn('Max recursion depth exceeded in resolveLoop');
      return null;
    }
    const entry = entityMap.get(index);
    if (!entry) {
      console.warn(`Loop index ${index} not found in entityMap`);
      return null;
    }
    if (entry.resolved) return entry.resolved;
    if (entry.type !== 'loop') {
      console.warn(`Entity at index ${index} is not a loop: ${entry.type}`);
      return null;
    }
    const attrs = entry.attributes;
    if (!attrs || attrs.length < 2) {
      console.warn(`Invalid attributes for loop at index ${index}: ${JSON.stringify(attrs)}`);
      return null;
    }
    const coedgePtr = attrs[3] as number; // first coedge
    const loop: Loop = { coedges: [] };
    let currentCoedgePtr = coedgePtr;
    while (currentCoedgePtr >= 0 && currentCoedgePtr < entityMap.size) {
      const coedgeEntry = entityMap.get(currentCoedgePtr);
      if (!coedgeEntry || coedgeEntry.type !== 'coedge') {
        console.warn(`Invalid coedge at index ${currentCoedgePtr}: ${coedgeEntry?.type || 'not found'}`);
        currentCoedgePtr = coedgeEntry?.attributes[2] || -1;
        continue;
      }
      const coedge = this.resolveCoedge(currentCoedgePtr, entityMap, depth + 1);
      if (coedge) {
        loop.coedges.push(coedge);
      } else {
        console.warn(`Failed to resolve coedge at index ${currentCoedgePtr}`);
      }
      currentCoedgePtr = coedgeEntry.attributes[2] || -1; // next coedge
    }
    if (loop.coedges.length === 0) {
      console.warn(`No coedges resolved for loop ${index}`);
    }
    entry.resolved = loop;
    return loop;
  }

  private resolveCoedge(index: number, entityMap: Map<number, any>, depth: number): Coedge | null {
    if (depth > 100) {
      console.warn('Max recursion depth exceeded in resolveCoedge');
      return null;
    }
    const entry = entityMap.get(index);
    if (!entry) {
      console.warn(`Coedge index ${index} not found in entityMap`);
      return null;
    }
    if (entry.resolved) return entry.resolved;
    if (entry.type !== 'coedge') {
      console.warn(`Entity at index ${index} is not a coedge: ${entry.type}`);
      return null;
    }
    const attrs = entry.attributes;
    if (!attrs || attrs.length < 6) {
      console.warn(`Invalid attributes for coedge at index ${index}: ${JSON.stringify(attrs)}`);
      return null;
    }
    const edgePtr = attrs[5] as number;
    const sense = attrs[6] === 'forward';
    const partnerPtr = attrs[4] as number;
    const nextPtr = attrs[2] as number;
    const prevPtr = attrs[3] as number;
    const coedge: Coedge = {
      edge: edgePtr >= 0 ? this.resolveEdge(edgePtr, entityMap, depth + 1) : null,
      sense,
      partner: partnerPtr >= 0 ? this.resolveCoedge(partnerPtr, entityMap, depth + 1) : null,
      next: nextPtr >= 0 ? this.resolveCoedge(nextPtr, entityMap, depth + 1) : null,
      prev: prevPtr >= 0 ? this.resolveCoedge(prevPtr, entityMap, depth + 1) : null,
    };
    entry.resolved = coedge;
    return coedge;
  }

  private resolveEdge(index: number, entityMap: Map<number, any>, depth: number): Edge | null {
    if (depth > 100) {
      console.warn('Max recursion depth exceeded in resolveEdge');
      return null;
    }
    const entry = entityMap.get(index);
    if (!entry) {
      console.warn(`Edge index ${index} not found in entityMap`);
      return null;
    }
    if (entry.resolved) return entry.resolved;
    if (entry.type !== 'edge') {
      console.warn(`Entity at index ${index} is not an edge: ${entry.type}`);
      return null;
    }
    const attrs = entry.attributes;
    if (!attrs || attrs.length < 6) {
      console.warn(`Invalid attributes for edge at index ${index}: ${JSON.stringify(attrs)}`);
      return null;
    }
    const startVertexPtr = attrs[2] as number;
    const endVertexPtr = attrs[3] as number;
    const curvePtr = attrs[4] as number;
    const sense = attrs[5] === 'forward';
    const startParam = attrs[6];
    const endParam = attrs[7];
    const edge: Edge = {
      startVertex: startVertexPtr >= 0 ? this.resolveVertex(startVertexPtr, entityMap, depth + 1) : null,
      endVertex: endVertexPtr >= 0 ? this.resolveVertex(endVertexPtr, entityMap, depth + 1) : null,
      curve: curvePtr >= 0 ? this.resolveCurve(curvePtr, entityMap, depth + 1) : null,
      sense,
      startParam,
      endParam,
    };
    entry.resolved = edge;
    return edge;
  }

  private resolveVertex(index: number, entityMap: Map<number, any>, depth: number): Vertex | null {
    if (depth > 100) {
      console.warn('Max recursion depth exceeded in resolveVertex');
      return null;
    }
    const entry = entityMap.get(index);
    if (!entry) {
      console.warn(`Vertex index ${index} not found in entityMap`);
      return null;
    }
    if (entry.resolved) return entry.resolved;
    if (entry.type !== 'vertex') {
      console.warn(`Entity at index ${index} is not a vertex: ${entry.type}`);
      return null;
    }
    const attrs = entry.attributes;
    if (!attrs || attrs.length < 3) {
      console.warn(`Invalid attributes for vertex at index ${index}: ${JSON.stringify(attrs)}`);
      return null;
    }
    const pointPtr = attrs[2] as number;
    const vertex: Vertex = {
      point: pointPtr >= 0 ? this.resolvePoint(pointPtr, entityMap, depth + 1) : null,
    };
    entry.resolved = vertex;
    return vertex;
  }

  private resolvePoint(index: number, entityMap: Map<number, any>, depth: number): Point | null {
    if (depth > 100) {
      console.warn('Max recursion depth exceeded in resolvePoint');
      return null;
    }
    const entry = entityMap.get(index);
    if (!entry) {
      console.warn(`Point index ${index} not found in entityMap`);
      return null;
    }
    if (entry.resolved) return entry.resolved;
    if (entry.type !== 'point') {
      console.warn(`Entity at index ${index} is not a point: ${entry.type}`);
      return null;
    }
    const attrs = entry.attributes;
    if (!attrs || attrs.length < 4) {
      console.warn(`Invalid attributes for point at index ${index}: ${JSON.stringify(attrs)}`);
      return null;
    }
    const point: Point = {
      location: [attrs[1], attrs[2], attrs[3]],
    };
    entry.resolved = point;
    return point;
  }

  private resolveCurve(index: number, entityMap: Map<number, any>, depth: number): StraightCurve | null {
    if (depth > 100) {
      console.warn('Max recursion depth exceeded in resolveCurve');
      return null;
    }
    const entry = entityMap.get(index);
    if (!entry) {
      console.warn(`Curve index ${index} not found in entityMap`);
      return null;
    }
    if (entry.resolved) return entry.resolved;
    if (entry.type !== 'straight-curve') {
      console.warn(`Entity at index ${index} is not a straight-curve: ${entry.type}`);
      return null;
    }
    const attrs = entry.attributes;
    if (!attrs || attrs.length < 7) {
      console.warn(`Invalid attributes for curve at index ${index}: ${JSON.stringify(attrs)}`);
      return null;
    }
    const curve: StraightCurve = {
      origin: [attrs[1], attrs[2], attrs[3]],
      direction: [attrs[4], attrs[5], attrs[6]],
    };
    entry.resolved = curve;
    return curve;
  }

  private resolveSurface(index: number, entityMap: Map<number, any>, depth: number): PlaneSurface | null {
    if (depth > 100) {
      console.warn('Max recursion depth exceeded in resolveSurface');
      return null;
    }
    const entry = entityMap.get(index);
    if (!entry) {
      console.warn(`Surface index ${index} not found in entityMap`);
      return null;
    }
    if (entry.resolved) return entry.resolved;
    if (entry.type !== 'plane-surface') {
      console.warn(`Entity at index ${index} is not a plane-surface: ${entry.type}`);
      return null;
    }
    const attrs = entry.attributes;
    if (!attrs || attrs.length < 17) {
      console.warn(`Invalid attributes for surface at index ${index}: ${JSON.stringify(attrs)}`);
      return null;
    }
    const surface: PlaneSurface = {
      origin: [attrs[1], attrs[2], attrs[3]],
      normal: [attrs[4], attrs[5], attrs[6]],
      uDir: [attrs[7], attrs[8], attrs[9]],
      vDir: [attrs[10], attrs[11], attrs[12]],
      reverseV: attrs[13] === 'reverse_v' || attrs[13] === 'forward_v',
      uClosed: attrs[14] === 'I',
      vClosed: attrs[15] === 'I',
      selfIntersect: attrs[16] === 'I',
    };
    entry.resolved = surface;
    return surface;
  }
}