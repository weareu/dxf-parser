import * as helpers from '../ParseHelpers.js';
export default class Mesh {
    ForEntityName = 'MESH';
    parseEntity(scanner, curr) {
        const entity = {
            type: curr.value,
            vertices: [],
            faces: [],
            edges: [],
            vertexCount: 0,
            faceCount: 0,
            edgeCount: 0,
            subdivisionLevel: 0,
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
            extendedDataCodes: [],
        };
        curr = scanner.next();
        while (!scanner.isEOF() && curr.code !== 0) {
            switch (curr.code) {
                case 5: // Handle
                    entity.handle = curr.value;
                    break;
                case 71: // Subdivision level
                    entity.subdivisionLevel = curr.value;
                    break;
                case 91: // Vertex count
                    entity.vertexCount = curr.value;
                    break;
                case 92: // Face count
                    entity.faceCount = curr.value;
                    break;
                case 93: // Edge count
                    entity.edgeCount = curr.value;
                    // Parse edges
                    const edge = [];
                    curr = scanner.next();
                    while (!scanner.isEOF() && curr.code !== 0 && curr.code !== 94 && curr.code !== 1001) {
                        if (curr.code === 95) {
                            edge.push(curr.value);
                        }
                        curr = scanner.next();
                    }
                    if (edge.length > 0) {
                        entity.edges.push(edge);
                    }
                    scanner.rewind();
                    break;
                case 10: // Vertex coordinates
                    const vertex = { x: curr.value, y: 0, z: 0 };
                    curr = scanner.next();
                    if (curr.code !== 20) {
                        throw new Error(`Expected code 20 for vertex y-coordinate, got ${curr.code}`);
                    }
                    vertex.y = curr.value;
                    curr = scanner.next();
                    if (curr.code === 30) {
                        vertex.z = curr.value;
                        curr = scanner.next();
                    }
                    else {
                        scanner.rewind();
                    }
                    entity.vertices.push(vertex);
                    if (entity.vertexCount === 0) {
                        entity.vertexCount = entity.vertices.length;
                    }
                    break;
                case 94: // Face indices
                    const faceSize = curr.value;
                    if (faceSize > 4) {
                        curr = scanner.next();
                        while (!scanner.isEOF() && curr.code !== 0 && curr.code !== 94 && curr.code !== 93 && curr.code !== 1001) {
                            curr = scanner.next();
                        }
                        scanner.rewind();
                        break;
                    }
                    const face = [];
                    let indicesFound = 0;
                    while (indicesFound < faceSize && !scanner.isEOF()) {
                        curr = scanner.next();
                        if (curr.code === 95) {
                            face.push(curr.value);
                            indicesFound++;
                        }
                        else if (curr.code === 0 || curr.code === 94 || curr.code === 93 || curr.code === 1001) {
                            scanner.rewind();
                            break;
                        }
                    }
                    if (face.length > 0) {
                        entity.faces.push(face);
                    }
                    break;
                case 1001: // Extended data
                    entity.extendedData.applicationName = curr.value;
                    curr = scanner.next();
                    while (curr.code === 1000 && !scanner.isEOF()) {
                        entity.extendedData.customStrings.push(curr.value);
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
        return entity;
    }
}
