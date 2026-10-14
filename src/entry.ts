import { createParticleObject } from "./lib/ParticleObject/ParticleObjectVanilla";
import { createFlow3D } from "./flow3d";
(window as any).createParticleObject = createParticleObject;
(window as any).createFlow3D = createFlow3D;
