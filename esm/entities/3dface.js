import * as helpers from '../ParseHelpers.js';
export default class ThreeDface {
    ForEntityName = '3DFACE';
    parseEntity(scanner, curr) {
        const entity = {
            type: curr.value,
            vertices: [],
            shape: false,
            hasContinuousLinetypePattern: false,
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
            if (curr.code === 0)
                break;
            switch (curr.code) {
                case 70: // 1 = Closed shape, 128 = plinegen?, 0 = default
                    entity.shape = (curr.value & 1) === 1;
                    entity.hasContinuousLinetypePattern = (curr.value & 128) === 128;
                    break;
                case 10: // X coordinate of point
                    entity.vertices = parse3dFaceVertices(scanner, curr);
                    curr = scanner.lastReadGroup;
                    break;
                default:
                    helpers.checkCommonEntityProperties(entity, curr, scanner);
                    break;
            }
            curr = scanner.next();
        }
        return entity;
    }
}
function parse3dFaceVertices(scanner, curr) {
    const vertices = [];
    const verticesPer3dFace = 4; // Up to four vertices per face, 3 for TIN
    let vertexIsStarted = false;
    let vertexIsFinished = false;
    for (let i = 0; i < verticesPer3dFace; i++) { // Changed <= to <
        const vertex = { x: 0, y: 0, z: 0 };
        while (!scanner.isEOF()) {
            if (curr.code === 0 || vertexIsFinished)
                break;
            switch (curr.code) {
                case 10: // X0
                case 11: // X1
                case 12: // X2
                case 13: // X3
                    if (vertexIsStarted) {
                        vertexIsFinished = true;
                        continue;
                    }
                    vertex.x = curr.value;
                    vertexIsStarted = true;
                    break;
                case 20: // Y
                case 21:
                case 22:
                case 23:
                    vertex.y = curr.value;
                    break;
                case 30: // Z
                case 31:
                case 32:
                case 33:
                    vertex.z = curr.value;
                    break;
                default:
                    if (vertexIsStarted) {
                        vertices.push(vertex); // Push vertex before returning
                    }
                    scanner.rewind();
                    return vertices;
            }
            curr = scanner.next();
        }
        if (vertexIsStarted) {
            vertices.push(vertex); // Push completed vertex
        }
        vertexIsStarted = false;
        vertexIsFinished = false;
    }
    scanner.rewind();
    return vertices;
}
