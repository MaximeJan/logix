// Construction de la donnée d'un composant personnalisé — logique pure, sans React.
// Le handler d'UI (confirmSaveAsComp) garde la validation des noms (alertes) et
// les effets (commit/setState) ; ici on ne fait que façonner la structure de
// données stockée dans customDefinitions, à partir d'un ensemble de composants.
import type { CircuitComponent, Wire } from '../domain/types';
import type { CustomDefData } from '../gates/registry';

export interface PortMapping {
  /** id du composant INPUT/OUTPUT interne servant de port externe */
  id: string;
  /** nom du port externe (déjà saisi par l'utilisateur) */
  name: string;
}

/**
 * Construit la définition (CustomDefData) à partir de la sélection :
 *  - ne garde que les ports dont l'internalId existe encore parmi `sourceComps` ;
 *  - la largeur d'un port externe = largeur du composant INPUT/OUTPUT interne ;
 *  - clone composants et fils internes (copie défensive).
 */
export function buildCustomDefData(
  name: string,
  inputs: PortMapping[],
  outputs: PortMapping[],
  sourceComps: CircuitComponent[],
  internalWires: Wire[],
): CustomDefData {
  const portWidthFor = (id: string) => {
    const internal = sourceComps.find((c) => c.id === id);
    return internal?.state?.width ?? 1;
  };
  const mapPort = (p: PortMapping) => ({
    name: p.name.trim(),
    internalId: p.id,
    width: portWidthFor(p.id),
  });
  const present = (p: PortMapping) => sourceComps.some((c) => c.id === p.id);

  return {
    name,
    inputs: inputs.filter(present).map(mapPort),
    outputs: outputs.filter(present).map(mapPort),
    circuit: {
      components: sourceComps.map((c) => ({ ...c })),
      wires: internalWires.map((w) => ({ ...w, from: { ...w.from }, to: { ...w.to } })),
    },
  };
}
