import * as helpers from '../ParseHelpers.js';
export default class Hatch {
    ForEntityName = 'HATCH';
    parseEntity(scanner, curr) {
        const entity = {
            type: curr.value,
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
            if (curr.code === 0)
                break;
            switch (curr.code) {
                case 2: // Pattern name
                    entity.patternName = curr.value;
                    break;
                case 5: // Handle (override to ensure string)
                    entity.handle = curr.value;
                    break;
                case 10: // Elevation point X
                    entity.elevationX = curr.value;
                    break;
                case 20: // Elevation point Y
                    entity.elevationY = curr.value;
                    break;
                case 30: // Elevation point Z
                    entity.elevationZ = curr.value;
                    break;
                case 41: // Pattern scale
                    entity.patternScale = curr.value;
                    break;
                case 47: // Pixel size
                    entity.pixelSize = curr.value;
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
                    entity.style = curr.value;
                    break;
                case 76: // Hatch pattern type
                    entity.patternStyle = curr.value;
                    break;
                case 91: // Number of boundary paths
                    entity.boundaryPathsCount = curr.value;
                    entity.boundaries = [];
                    break;
                case 93: // Number of vertices in boundary
                    const boundaryVerticesCount = curr.value;
                    const boundary = this.parseHatchVertices(boundaryVerticesCount, scanner);
                    entity.boundaries.push(boundary);
                    curr = scanner.lastReadGroup;
                    break;
                case 98: // Number of seed points
                    entity.seedPointsCount = curr.value;
                    break;
                case 210: // Extrusion direction X
                    entity.extrusionDirectionX = curr.value;
                    break;
                case 220: // Extrusion direction Y
                    entity.extrusionDirectionY = curr.value;
                    break;
                case 230: // Extrusion direction Z
                    entity.extrusionDirectionZ = curr.value;
                    break;
                case 1000: // Extended data application name
                    entity.extendedData.applicationName = curr.value;
                    break;
                case 1001: // Extended data custom strings
                    entity.extendedData.customStrings.push(curr.value);
                    break;
                default:
                    helpers.checkCommonEntityProperties(entity, curr, scanner);
                    break;
            }
            curr = scanner.next();
        }
        return entity;
    }
    parseHatchVertices(n, scanner) {
        if (!n || n <= 0)
            throw new Error('n must be greater than 0 vertices');
        const vertices = [];
        let vertexIsStarted = false;
        let vertexIsFinished = false;
        let curr = scanner.next();
        for (let i = 0; i < n; i++) {
            const vertex = { x: 0, y: 0 };
            while (!scanner.isEOF()) {
                if (curr.code === 0 || vertexIsFinished)
                    break;
                switch (curr.code) {
                    case 10: // X
                        if (vertexIsStarted) {
                            vertexIsFinished = true;
                            continue;
                        }
                        vertex.x = curr.value;
                        vertexIsStarted = true;
                        break;
                    case 20: // Y
                        vertex.y = curr.value;
                        break;
                    case 42: // Bulge
                        if (curr.value !== 0)
                            vertex.bulge = curr.value;
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
