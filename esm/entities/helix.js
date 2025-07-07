import * as helpers from '../ParseHelpers.js';
export default class Helix {
    ForEntityName = 'HELIX';
    parseEntity(scanner, curr) {
        const entity = {
            type: curr.value,
            startPoint: { x: 0, y: 0, z: 0 },
            axisVector: { x: 0, y: 0, z: 0 },
            tangentDirection: { x: 0, y: 0, z: 0 },
            majorRadius: 0,
            minorRadius: 0,
            numberOfTurns: 0,
            turnHeight: 0,
            handedness: 0,
            constraintType: 0,
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
                case 5: // Handle
                    entity.handle = curr.value;
                    break;
                case 10: // Start point X
                    entity.startPoint.x = curr.value;
                    break;
                case 20: // Start point Y
                    entity.startPoint.y = curr.value;
                    break;
                case 30: // Start point Z
                    entity.startPoint.z = curr.value;
                    break;
                case 11: // Axis vector X
                    entity.axisVector.x = curr.value;
                    break;
                case 21: // Axis vector Y
                    entity.axisVector.y = curr.value;
                    break;
                case 31: // Axis vector Z
                    entity.axisVector.z = curr.value;
                    break;
                case 12: // Starting tangent direction X
                    entity.tangentDirection.x = curr.value;
                    break;
                case 22: // Starting tangent direction Y
                    entity.tangentDirection.y = curr.value;
                    break;
                case 32: // Starting tangent direction Z
                    entity.tangentDirection.z = curr.value;
                    break;
                case 40: // Major radius
                    entity.majorRadius = curr.value;
                    break;
                case 41: // Minor radius
                    entity.minorRadius = curr.value;
                    break;
                case 42: // Number of turns
                    entity.numberOfTurns = curr.value;
                    break;
                case 43: // Turn height
                    entity.turnHeight = curr.value;
                    break;
                case 70: // Handedness (0 = right, 1 = left)
                    entity.handedness = curr.value;
                    break;
                case 71: // Constraint type (0 = unconstrained, 1 = constrained)
                    entity.constraintType = curr.value;
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
