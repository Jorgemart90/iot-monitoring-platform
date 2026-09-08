import { InitialSchema1787270400000 } from './1787270400000-InitialSchema';
import { SeedDemoData1787270500000 } from './1787270500000-SeedDemoData';

/**
 * Registro explícito de migraciones, en orden de ejecución.
 *
 * No se usa un glob (`migrations/*.js`) a propósito: `nest build` empaqueta cada servicio
 * con webpack en un único bundle, así que en tiempo de ejecución no existe la carpeta
 * `migrations/` y el glob no encontraría nada — las migraciones no se aplicarían y el
 * arranque parecería correcto.
 *
 * IMPORTANTE: al crear una migración nueva hay que añadirla a este array.
 */
export const migrations = [InitialSchema1787270400000, SeedDemoData1787270500000];

export { InitialSchema1787270400000, SeedDemoData1787270500000 };
