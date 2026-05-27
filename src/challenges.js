// Données pédagogiques des niveaux de challenge
// Structure : CHAPTERS > levels > verify(type, truthTable ou steps)

export const CHAPTERS = [
  {
    id: 'portes',
    title: 'Portes logiques',
    levels: [
      {
        id: 'nand-not',
        title: 'NOT avec un NAND',
        description: 'Construis une porte NOT en branchant les deux entrées d\'un NAND ensemble. Nomme ton entrée « A » et ta sortie « S ».',
        allowedTypes: ['INPUT', 'OUTPUT', 'NAND'],
        inputs: [{ name: 'A', width: 1 }],
        outputs: [{ name: 'S', width: 1 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0], [1]],
          [[1], [0]],
        ],
      },
      {
        id: 'nand-and',
        title: 'AND avec des NANDs',
        description: 'Construis une porte AND avec 2 NANDs (NAND suivi de NAND-NOT). Entrées « A » et « B », sortie « S ».',
        allowedTypes: ['INPUT', 'OUTPUT', 'NAND'],
        inputs: [{ name: 'A', width: 1 }, { name: 'B', width: 1 }],
        outputs: [{ name: 'S', width: 1 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0, 0], [0]],
          [[0, 1], [0]],
          [[1, 0], [0]],
          [[1, 1], [1]],
        ],
      },
      {
        id: 'nand-or',
        title: 'OR avec des NANDs',
        description: 'Construis une porte OR avec 3 NANDs (De Morgan). Entrées « A » et « B », sortie « S ».',
        allowedTypes: ['INPUT', 'OUTPUT', 'NAND'],
        inputs: [{ name: 'A', width: 1 }, { name: 'B', width: 1 }],
        outputs: [{ name: 'S', width: 1 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0, 0], [0]],
          [[0, 1], [1]],
          [[1, 0], [1]],
          [[1, 1], [1]],
        ],
      },
      {
        id: 'nand-xor',
        title: 'XOR avec des NANDs',
        description: 'Construis une porte XOR avec 4 NANDs. Entrées « A » et « B », sortie « S ».',
        allowedTypes: ['INPUT', 'OUTPUT', 'NAND'],
        inputs: [{ name: 'A', width: 1 }, { name: 'B', width: 1 }],
        outputs: [{ name: 'S', width: 1 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0, 0], [0]],
          [[0, 1], [1]],
          [[1, 0], [1]],
          [[1, 1], [0]],
        ],
      },
      {
        id: 'half-adder',
        title: 'Demi-additionneur',
        description: 'Construis un demi-additionneur : entrées « A » et « B », sorties « S » (somme) et « C » (retenue).',
        allowedTypes: ['INPUT', 'OUTPUT', 'AND', 'XOR', 'NAND', 'NOR', 'OR'],
        inputs: [{ name: 'A', width: 1 }, { name: 'B', width: 1 }],
        outputs: [{ name: 'S', width: 1 }, { name: 'C', width: 1 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0, 0], [0, 0]],
          [[0, 1], [1, 0]],
          [[1, 0], [1, 0]],
          [[1, 1], [0, 1]],
        ],
      },
    ],
  },

  {
    id: 'combinatoire',
    title: 'Circuits combinatoires',
    levels: [
      {
        id: 'full-adder',
        title: 'Additionneur complet',
        description: 'Construis un additionneur 1 bit avec retenue. Entrées « A », « B », « Cin » (retenue entrante). Sorties « S » et « Cout ».',
        allowedTypes: ['INPUT', 'OUTPUT', 'AND', 'OR', 'XOR', 'NAND', 'NOR'],
        inputs: [{ name: 'A', width: 1 }, { name: 'B', width: 1 }, { name: 'Cin', width: 1 }],
        outputs: [{ name: 'S', width: 1 }, { name: 'Cout', width: 1 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0, 0, 0], [0, 0]],
          [[0, 0, 1], [1, 0]],
          [[0, 1, 0], [1, 0]],
          [[0, 1, 1], [0, 1]],
          [[1, 0, 0], [1, 0]],
          [[1, 0, 1], [0, 1]],
          [[1, 1, 0], [0, 1]],
          [[1, 1, 1], [1, 1]],
        ],
      },
      {
        id: 'mux2to1',
        title: 'MUX 2→1 simple',
        description: 'Construis un multiplexeur 2 vers 1 avec les portes de base. Entrées « A » et « B » (1 bit chacune), sélecteur « S », sortie « Y ».',
        allowedTypes: ['INPUT', 'OUTPUT', 'AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'],
        inputs: [{ name: 'A', width: 1 }, { name: 'B', width: 1 }, { name: 'S', width: 1 }],
        outputs: [{ name: 'Y', width: 1 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0, 0, 0], [0]],
          [[1, 0, 0], [1]],
          [[0, 1, 1], [1]],
          [[1, 1, 1], [1]],
        ],
      },
      {
        id: 'decoder2to4',
        title: 'Décodeur 2→4',
        description: 'Construis un décodeur qui convertit 2 bits en 4 sorties (une seule active à la fois). Entrées « A », « B ». Sorties « Y0 », « Y1 », « Y2 », « Y3 ».',
        allowedTypes: ['INPUT', 'OUTPUT', 'AND', 'NOT', 'NAND', 'NOR'],
        inputs: [{ name: 'A', width: 1 }, { name: 'B', width: 1 }],
        outputs: [{ name: 'Y0', width: 1 }, { name: 'Y1', width: 1 }, { name: 'Y2', width: 1 }, { name: 'Y3', width: 1 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0, 0], [1, 0, 0, 0]],
          [[0, 1], [0, 1, 0, 0]],
          [[1, 0], [0, 0, 1, 0]],
          [[1, 1], [0, 0, 0, 1]],
        ],
      },
      {
        id: 'comparator2bit',
        title: 'Comparateur 2 bits',
        description: 'Construis un comparateur : entrées « A1 A0 » (2 bits) et « B1 B0 ». Sorties « ALT » (A<B), « AEQ » (A=B), « AGT » (A>B).',
        allowedTypes: ['INPUT', 'OUTPUT', 'AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'],
        inputs: [{ name: 'A1', width: 1 }, { name: 'A0', width: 1 }, { name: 'B1', width: 1 }, { name: 'B0', width: 1 }],
        outputs: [{ name: 'ALT', width: 1 }, { name: 'AEQ', width: 1 }, { name: 'AGT', width: 1 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0, 0, 0, 0], [0, 1, 0]],
          [[0, 0, 0, 1], [1, 0, 0]],
          [[0, 0, 1, 0], [1, 0, 0]],
          [[0, 1, 0, 1], [0, 1, 0]],
          [[1, 0, 0, 1], [0, 0, 1]],
          [[1, 1, 1, 0], [0, 0, 1]],
        ],
      },
    ],
  },

  {
    id: 'sequentiel',
    title: 'Circuits séquentiels',
    levels: [
      {
        id: 'sr-latch',
        title: 'Verrou SR (NAND)',
        description: 'Construis un verrou SR avec 2 NANDs croisés. Entrées « S » (set) et « R » (reset), 1 sortie « Q ».',
        allowedTypes: ['INPUT', 'OUTPUT', 'NAND'],
        inputs: [{ name: 'S', width: 1 }, { name: 'R', width: 1 }],
        outputs: [{ name: 'Q', width: 1 }],
        verify: { type: 'sequence' },
        verify: {
          type: 'sequence',
          steps: [
            [[1, 1], [0]],  // repos
            [[0, 1], [1]],  // set
            [[1, 1], [1]],  // repos, reste set
            [[1, 0], [0]],  // reset
            [[1, 1], [0]],  // repos, reste reset
          ],
        },
      },
      {
        id: 'dff-simple',
        title: 'Bascule D simple',
        description: 'Construis une bascule D avec un verrou SR. Entrées « D » et « CLK », sortie « Q ».',
        allowedTypes: ['INPUT', 'OUTPUT', 'AND', 'OR', 'NOT', 'NAND', 'DFF'],
        inputs: [{ name: 'D', width: 1 }, { name: 'CLK', width: 1 }],
        outputs: [{ name: 'Q', width: 1 }],
        verify: { type: 'sequence' },
        verify: {
          type: 'sequence',
          steps: [
            [[0, 0], [0]],
            [[0, 1], [0]],  // edge montante capture D=0
            [[0, 0], [0]],
            [[1, 1], [1]],  // edge montante capture D=1
            [[1, 0], [1]],
          ],
        },
      },
      {
        id: 'reg4bit',
        title: 'Registre 4 bits',
        description: 'Construis un registre 4 bits avec 4 bascules D. Entrée « D » (4 bits), sortie « Q » (4 bits), une horloge « CLK ».',
        allowedTypes: ['INPUT', 'OUTPUT', 'DFF', 'REG'],
        inputs: [{ name: 'D', width: 4 }, { name: 'CLK', width: 1 }],
        outputs: [{ name: 'Q', width: 4 }],
        verify: { type: 'sequence' },
        verify: {
          type: 'sequence',
          steps: [
            [[0, 0], [0]],
            [[5, 1], [5]],  // edge montante capture 5 (0101)
            [[5, 0], [5]],
            [[10, 1], [10]],  // edge montante capture 10 (1010)
            [[10, 0], [10]],
          ],
        },
      },
      {
        id: 'shiftreg',
        title: 'Registre à décalage',
        description: 'Construis un registre à décalage 4 bits. Entrée « Din » (bit série), sorties « Q3 Q2 Q1 Q0 ».',
        allowedTypes: ['INPUT', 'OUTPUT', 'DFF', 'REG'],
        inputs: [{ name: 'Din', width: 1 }, { name: 'CLK', width: 1 }],
        outputs: [{ name: 'Q', width: 4 }],
        verify: { type: 'sequence' },
        verify: {
          type: 'sequence',
          steps: [
            [[0, 0], [0]],
            [[1, 1], [1]],  // décale 1 entrant
            [[1, 1], [3]],  // décale 1 (11 en binaire)
            [[0, 1], [6]],  // décale 0 (110)
            [[0, 1], [12]],  // décale 0 (1100)
          ],
        },
      },
    ],
  },

  {
    id: 'cpu',
    title: 'Processeur',
    levels: [
      {
        id: 'alu-4bit',
        title: 'ALU 4 bits',
        description: 'Construis une ALU qui réalise ADD, AND, OR, NOT selon 2 bits de contrôle. Entrées « A », « B » (4 bits), « Op » (2 bits). Sortie « R » (4 bits).',
        allowedTypes: ['INPUT', 'OUTPUT', 'AND', 'OR', 'NOT', 'MUX', 'DEMUX', 'DECODER'],
        inputs: [{ name: 'A', width: 4 }, { name: 'B', width: 4 }, { name: 'Op', width: 2 }],
        outputs: [{ name: 'R', width: 4 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[1, 2, 0], [3]],  // ADD
          [[1, 2, 1], [0]],  // AND
          [[1, 2, 2], [3]],  // OR
          [[1, 0, 3], [14]],  // NOT A
        ],
      },
      {
        id: 'regfile4',
        title: 'Banque 4 registres',
        description: 'Construis une banque de 4 registres 4 bits. Entrées « Addr » (2 bits sélection), « Din » (4 bits), « WE » (write enable). Sortie « Dout » (4 bits).',
        allowedTypes: ['INPUT', 'OUTPUT', 'REG', 'DECODER', 'MUX'],
        inputs: [{ name: 'Addr', width: 2 }, { name: 'Din', width: 4 }, { name: 'WE', width: 1 }],
        outputs: [{ name: 'Dout', width: 4 }],
        verify: { type: 'sequence' },
        verify: {
          type: 'sequence',
          steps: [
            [[0, 0, 0], [0]],
            [[0, 5, 1], [5]],  // write 5 à addr 0
            [[1, 10, 1], [0]],  // write 10 à addr 1, lire addr 0
            [[0, 0, 0], [5]],  // lire addr 0
          ],
        },
      },
      {
        id: 'cpu-minimal',
        title: 'CPU minimal',
        description: 'Construis un petit processeur : PC (compteur), RAM (8×4), ALU, banque registres. Cycle : fetch instruction, décode, exécute, write-back.',
        allowedTypes: ['INPUT', 'OUTPUT', 'REG', 'COUNTER', 'RAM', 'DECODER', 'MUX', 'AND', 'OR', 'NOT'],
        inputs: [{ name: 'Reset', width: 1 }, { name: 'CLK', width: 1 }],
        outputs: [{ name: 'PCout', width: 3 }, { name: 'AluOut', width: 4 }],
        verify: { type: 'sequence' },
        verify: {
          type: 'sequence',
          steps: [
            [[1, 0], [0, 0]],  // reset
            [[0, 1], [1, 0]],  // cycle 1
            [[0, 1], [2, 0]],  // cycle 2
          ],
        },
      },
    ],
  },
];

// Fonction utilitaire : récupérer un chapitre par ID
export function getChapter(chapterId) {
  return CHAPTERS.find((ch) => ch.id === chapterId);
}

// Fonction utilitaire : récupérer un niveau par chapitre et ID
export function getLevel(chapterId, levelId) {
  const chapter = getChapter(chapterId);
  return chapter ? chapter.levels.find((l) => l.id === levelId) : null;
}

// Fonction utilitaire : liste plate de tous les niveaux (pour déblocage)
export function getAllLevels() {
  const all = [];
  for (const chapter of CHAPTERS) {
    for (const level of chapter.levels) {
      all.push({ ...level, chapterId: chapter.id });
    }
  }
  return all;
}

// Déblocage par défaut : premier niveau de chaque chapitre (sauf CPU)
export function getDefaultUnlockedLevels() {
  const unlocked = [];
  for (const chapter of CHAPTERS) {
    if (chapter.id !== 'cpu') {
      unlocked.push(chapter.levels[0].id);
    }
  }
  return unlocked;
}
