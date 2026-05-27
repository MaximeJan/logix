// Données pédagogiques des niveaux de challenge
// Structure : CHAPTERS > levels > verify(type, truthTable ou steps)
//
// Progression : on part de la porte NAND (universelle), on reconstruit les
// portes de base, puis on bâtit l'arithmétique (demi-additionneur, additionneur
// complet, additionneur N bits), avant d'aborder les briques d'un processeur
// (registres, compteur/PC, banque de registres). Le chapitre « Pour aller plus
// loin » regroupe des circuits combinatoires classiques (mux, décodeur,
// comparateur) hors du chemin principal.
//
// Appariement entrées/sorties : la vérification associe les INPUT et OUTPUT
// du circuit de l'élève PAR ORDRE DE CRÉATION (les labels sont ignorés). Les
// descriptions précisent donc toujours l'ordre dans lequel créer les ports.

export const CHAPTERS = [
  {
    id: 'portes',
    title: 'Portes logiques',
    levels: [
      {
        id: 'nand-not',
        title: 'NOT avec un NAND',
        description:
          'La porte NAND est « universelle » : elle suffit à reconstruire toutes les autres. '
          + 'Commence par la plus simple : une porte NOT. Relie les DEUX entrées d\'un même NAND '
          + 'ensemble — il inverse alors l\'unique signal qu\'il reçoit. '
          + 'Crée l\'entrée « A », puis la sortie « S ».',
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
        title: 'AND avec 2 NAND',
        description:
          'Un NAND, c\'est un AND suivi d\'un NOT. Pour retrouver le AND, il suffit donc '
          + 'd\'inverser la sortie du NAND. Branche A et B sur un premier NAND, puis envoie son '
          + 'résultat dans un second NAND monté en NOT (ses deux entrées reliées). '
          + 'Ordre des entrées : A, puis B. Sortie : S.',
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
        title: 'OR avec 3 NAND',
        description:
          'Loi de De Morgan : A OR B = NON(NON A ET NON B). Inverse d\'abord A avec un NAND-NOT, '
          + 'inverse B avec un autre NAND-NOT, puis combine ces deux signaux inversés dans un '
          + 'troisième NAND. Ordre des entrées : A, puis B. Sortie : S.',
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
        title: 'XOR avec 4 NAND',
        description:
          'Le XOR (« ou exclusif ») vaut 1 quand A et B diffèrent. On l\'obtient avec 4 NAND. '
          + 'Indice : calcule d\'abord N = A NAND B. Puis P = A NAND N et Q = B NAND N. '
          + 'Termine par S = P NAND Q. Ordre des entrées : A, puis B. Sortie : S.',
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
    ],
  },

  {
    id: 'arithmetique',
    title: 'Arithmétique',
    levels: [
      {
        id: 'half-adder',
        title: 'Demi-additionneur',
        description:
          'Additionne 2 bits. La somme vaut S = A XOR B (1 si A et B diffèrent), et la retenue '
          + 'vaut C = A AND B (1 seulement si les deux valent 1). Tu peux utiliser les portes de '
          + 'base directement. Ordre des entrées : A, B. Ordre des sorties : S (somme), C (retenue).',
        allowedTypes: ['INPUT', 'OUTPUT', 'AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR'],
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
      {
        id: 'full-adder',
        title: 'Additionneur complet',
        description:
          'L\'additionneur complet ajoute aussi une retenue entrante Cin — c\'est la brique de '
          + 'base pour additionner des nombres de plusieurs bits. '
          + 'S = A XOR B XOR Cin. Cout = (A AND B) OR (Cin AND (A XOR B)). '
          + 'Ordre des entrées : A, B, Cin. Ordre des sorties : S, Cout. '
          + 'Astuce : en mode libre, tu peux enregistrer ce circuit comme composant réutilisable '
          + '(le sélectionner puis « Créer un composant »), ou utiliser le composant '
          + '« Additionneur » déjà intégré.',
        allowedTypes: ['INPUT', 'OUTPUT', 'AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR'],
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
        id: 'adder-4bit',
        title: 'Additionneur 4 bits',
        description:
          'Additionne deux nombres de 4 bits d\'un coup, à l\'aide du composant « Additionneur » '
          + '(catégorie Arithmétique). Place-le, règle sa largeur sur 4 bits dans le panneau '
          + 'Propriétés, puis relie A, B et Cin. Observe la retenue sortante Cout quand le résultat '
          + 'dépasse 15. Ordre des entrées : A (4 bits), B (4 bits), Cin. Ordre des sorties : '
          + 'S (4 bits), Cout.',
        allowedTypes: ['INPUT', 'OUTPUT', 'ADDER'],
        inputs: [{ name: 'A', width: 4 }, { name: 'B', width: 4 }, { name: 'Cin', width: 1 }],
        outputs: [{ name: 'S', width: 4 }, { name: 'Cout', width: 1 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0, 0, 0], [0, 0]],
          [[3, 5, 0], [8, 0]],
          [[7, 8, 0], [15, 0]],
          [[15, 1, 0], [0, 1]],
          [[9, 9, 1], [3, 1]],
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
        title: 'Verrou SR',
        description:
          'Un verrou (latch) est la plus petite mémoire : il retient 1 bit. Utilise le composant '
          + '« Verrou SR ». S = 1 force la sortie Q à 1 (set), R = 1 la force à 0 (reset). '
          + 'Quand S et R valent 0, Q conserve sa dernière valeur. Pour tester, on enverra une '
          + 'séquence d\'impulsions. Ordre des entrées : S, R. Sortie : Q.',
        allowedTypes: ['INPUT', 'OUTPUT', 'SRLATCH'],
        inputs: [{ name: 'S', width: 1 }, { name: 'R', width: 1 }],
        outputs: [{ name: 'Q', width: 1 }],
        verify: {
          type: 'sequence',
          steps: [
            [[0, 0], [0]],  // repos : Q part à 0
            [[1, 0], [1]],  // set
            [[0, 0], [1]],  // repos : reste à 1 (mémoire)
            [[0, 1], [0]],  // reset
            [[0, 0], [0]],  // repos : reste à 0
          ],
        },
      },
      {
        id: 'register-load',
        title: 'Registre avec chargement',
        description:
          'Un registre mémorise un nombre et ne le met à jour que lorsqu\'on le lui demande. '
          + 'Utilise le composant « Registre ». À chaque front montant de CLK, Q ← D si LD = 1, '
          + 'sinon Q garde sa valeur. Règle la largeur sur 4 bits. '
          + 'Ordre des entrées : D (4 bits), LD, CLK. Sortie : Q (4 bits).',
        allowedTypes: ['INPUT', 'OUTPUT', 'REG'],
        inputs: [{ name: 'D', width: 4 }, { name: 'LD', width: 1 }, { name: 'CLK', width: 1 }],
        outputs: [{ name: 'Q', width: 4 }],
        verify: {
          type: 'sequence',
          steps: [
            [[5, 1, 0], [0]],   // CLK bas : rien
            [[5, 1, 1], [5]],   // front montant, LD=1 → charge 5
            [[9, 0, 0], [5]],   // CLK bas
            [[9, 0, 1], [5]],   // front montant mais LD=0 → conserve 5
            [[2, 1, 0], [5]],   // CLK bas
            [[2, 1, 1], [2]],   // front montant, LD=1 → charge 2
          ],
        },
      },
      {
        id: 'shift-register',
        title: 'Registre à décalage',
        description:
          'Quatre bascules D en série forment un registre à décalage : à chaque front montant, '
          + 'chaque bit recopie celui de son voisin, et un nouveau bit Din entre par la gauche. '
          + 'Chaîne 4 bascules « Bascule D » (D₀ ← Din, D₁ ← Q₀, D₂ ← Q₁, D₃ ← Q₂), toutes '
          + 'reliées à la même horloge CLK. Ordre des entrées : Din, CLK. '
          + 'Ordre des sorties : Q0, Q1, Q2, Q3 (Q0 = bit qui vient d\'entrer).',
        allowedTypes: ['INPUT', 'OUTPUT', 'DFF'],
        inputs: [{ name: 'Din', width: 1 }, { name: 'CLK', width: 1 }],
        outputs: [
          { name: 'Q0', width: 1 }, { name: 'Q1', width: 1 },
          { name: 'Q2', width: 1 }, { name: 'Q3', width: 1 },
        ],
        verify: {
          type: 'sequence',
          steps: [
            [[1, 0], [0, 0, 0, 0]],
            [[1, 1], [1, 0, 0, 0]],  // front : 1 entre
            [[1, 0], [1, 0, 0, 0]],
            [[1, 1], [1, 1, 0, 0]],  // front : 1 entre, l'ancien décale
            [[0, 0], [1, 1, 0, 0]],
            [[0, 1], [0, 1, 1, 0]],  // front : 0 entre, tout décale
          ],
        },
      },
    ],
  },

  {
    id: 'processeur',
    title: 'Vers le processeur',
    levels: [
      {
        id: 'program-counter',
        title: 'Compteur de programme (PC)',
        description:
          'Le compteur de programme indique l\'adresse de la prochaine instruction. C\'est un '
          + 'compteur : à chaque front montant de CLK, il s\'incrémente si EN = 1 ; RST = 1 le '
          + 'remet à 0 immédiatement. Utilise le composant « Compteur », largeur 3 bits '
          + '(adresses 0 à 7). Ordre des entrées : EN, CLK, RST. Sortie : Q (3 bits).',
        allowedTypes: ['INPUT', 'OUTPUT', 'COUNTER'],
        inputs: [{ name: 'EN', width: 1 }, { name: 'CLK', width: 1 }, { name: 'RST', width: 1 }],
        outputs: [{ name: 'Q', width: 3 }],
        verify: {
          type: 'sequence',
          steps: [
            [[0, 0, 1], [0]],  // reset
            [[1, 1, 0], [1]],  // front, EN=1 → 1
            [[1, 0, 0], [1]],
            [[1, 1, 0], [2]],  // front → 2
            [[0, 0, 0], [2]],
            [[0, 1, 0], [2]],  // front mais EN=0 → conserve 2
            [[1, 0, 0], [2]],
            [[1, 1, 0], [3]],  // front, EN=1 → 3
          ],
        },
      },
      {
        id: 'bitwise-and',
        title: 'ET bit à bit (4 bits)',
        description:
          'Les portes de base ne traitent qu\'un bit. Pour appliquer un ET sur deux bus de 4 bits, '
          + 'on éclate chaque bus en bits, on combine paire par paire, puis on regroupe. '
          + 'Place un « Séparateur » (largeur 4) sur A et un autre sur B, relie chaque paire de '
          + 'bits de même rang à une porte AND, puis rassemble les 4 résultats avec un '
          + '« Fusionneur » (largeur 4). Ordre des entrées : A (4 bits), B (4 bits). '
          + 'Sortie : R (4 bits).',
        allowedTypes: ['INPUT', 'OUTPUT', 'SPLITTER', 'MERGER', 'AND'],
        inputs: [{ name: 'A', width: 4 }, { name: 'B', width: 4 }],
        outputs: [{ name: 'R', width: 4 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[12, 10], [8]],
          [[15, 9], [9]],
          [[7, 14], [6]],
          [[0, 15], [0]],
          [[15, 15], [15]],
        ],
      },
      {
        id: 'alu-4bit',
        title: 'ALU 4 bits',
        description:
          'L\'unité arithmétique et logique (ALU) est le cœur de calcul du processeur. '
          + 'Construis-en une qui effectue 4 opérations sur A et B (4 bits) selon le code Op '
          + '(2 bits) : Op=0 → A+B (composant Additionneur) ; Op=1 → A ET B (bit à bit) ; '
          + 'Op=2 → A OU B (bit à bit) ; Op=3 → NON A (bit à bit). '
          + 'Calcule les 4 résultats en parallèle, puis choisis le bon avec un multiplexeur '
          + '(sélecteur 2 bits, données 4 bits) piloté par Op. '
          + 'Ordre des entrées : A (4 bits), B (4 bits), Op (2 bits). Sortie : R (4 bits).',
        allowedTypes: ['INPUT', 'OUTPUT', 'ADDER', 'SPLITTER', 'MERGER', 'AND', 'OR', 'NOT', 'MUX'],
        inputs: [{ name: 'A', width: 4 }, { name: 'B', width: 4 }, { name: 'Op', width: 2 }],
        outputs: [{ name: 'R', width: 4 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[5, 3, 0], [8]],    // ADD
          [[9, 6, 0], [15]],   // ADD
          [[12, 10, 1], [8]],  // AND
          [[12, 10, 2], [14]], // OR
          [[5, 0, 3], [10]],   // NOT A
          [[15, 15, 1], [15]], // AND
        ],
      },
      {
        id: 'register-file',
        title: 'Banque de 4 registres',
        description:
          'Un processeur range ses variables dans une petite banque de registres adressables. '
          + 'Construis-en une de 4 registres 4 bits. Lecture (combinatoire) : un multiplexeur '
          + 'choisit, selon Addr, lequel des 4 registres sort sur Dout. Écriture (synchrone) : '
          + 'un décodeur 2→4 sur Addr, dont chaque sortie passe par un AND avec WE, pilote le LD '
          + 'du registre correspondant ; Din alimente le D de tous les registres. '
          + 'Ordre des entrées : Addr (2 bits), Din (4 bits), WE, CLK. Sortie : Dout (4 bits).',
        allowedTypes: ['INPUT', 'OUTPUT', 'REG', 'MUX', 'DECODER', 'AND'],
        inputs: [
          { name: 'Addr', width: 2 }, { name: 'Din', width: 4 },
          { name: 'WE', width: 1 }, { name: 'CLK', width: 1 },
        ],
        outputs: [{ name: 'Dout', width: 4 }],
        verify: {
          type: 'sequence',
          steps: [
            [[0, 5, 1, 0], [0]],  // CLK bas : lecture reg0 = 0
            [[0, 5, 1, 1], [5]],  // front : écrit 5 dans reg0, relit reg0 = 5
            [[1, 9, 1, 0], [0]],  // adresse reg1 (vide) = 0
            [[1, 9, 1, 1], [9]],  // front : écrit 9 dans reg1, relit reg1 = 9
            [[0, 0, 0, 0], [5]],  // relit reg0 = 5 (toujours là)
            [[1, 0, 0, 0], [9]],  // relit reg1 = 9
          ],
        },
      },
      {
        id: 'accumulator',
        title: 'Accumulateur',
        description:
          'Un accumulateur additionne au fur et à mesure : à chaque coup d\'horloge, il ajoute '
          + 'l\'entrée IN à son total. C\'est une boucle : la sortie du registre repart dans un '
          + 'additionneur. Branche la sortie Q d\'une « Bascule D » (largeur 4) sur l\'entrée A '
          + 'd\'un « Additionneur » (largeur 4), IN sur B, Cin à 0, et renvoie la somme S vers '
          + 'l\'entrée D de la bascule. La même horloge CLK cadence le tout. '
          + 'Ordre des entrées : IN (4 bits), CLK. Sortie : ACC (4 bits).',
        allowedTypes: ['INPUT', 'OUTPUT', 'ADDER', 'DFF'],
        inputs: [{ name: 'IN', width: 4 }, { name: 'CLK', width: 1 }],
        outputs: [{ name: 'ACC', width: 4 }],
        verify: {
          type: 'sequence',
          steps: [
            [[3, 0], [0]],
            [[3, 1], [3]],   // front : 0 + 3
            [[5, 0], [3]],
            [[5, 1], [8]],   // front : 3 + 5
            [[4, 0], [8]],
            [[4, 1], [12]],  // front : 8 + 4
          ],
        },
      },
      {
        id: 'mini-cpu',
        title: 'Mini-processeur',
        description:
          'La pièce maîtresse : un processeur à accumulateur, en un cycle par instruction. '
          + 'Un registre ACC garde le résultat courant ; à chaque coup d\'horloge, il devient '
          + 'ACC ← ACC (op) Imm, où op vient de l\'ALU que tu as déjà construite. '
          + 'Assemble une ALU (Op=0 ADD, 1 ET, 2 OU, 3 NON ACC) prenant A = ACC et B = Imm, et '
          + 'renvoie sa sortie dans une « Bascule D » de 4 bits (utilise son entrée RST pour '
          + 'Reset). Op=3 (NON) ignore Imm. '
          + 'Ordre des entrées : Op (2 bits), Imm (4 bits), Reset, CLK. Sortie : ACC (4 bits).',
        allowedTypes: ['INPUT', 'OUTPUT', 'ADDER', 'SPLITTER', 'MERGER', 'AND', 'OR', 'NOT', 'MUX', 'DFF'],
        inputs: [
          { name: 'Op', width: 2 }, { name: 'Imm', width: 4 },
          { name: 'Reset', width: 1 }, { name: 'CLK', width: 1 },
        ],
        outputs: [{ name: 'ACC', width: 4 }],
        verify: {
          type: 'sequence',
          steps: [
            [[0, 0, 1, 0], [0]],   // Reset
            [[0, 5, 0, 1], [5]],   // ADD : 0 + 5
            [[0, 3, 0, 0], [5]],
            [[0, 3, 0, 1], [8]],   // ADD : 5 + 3
            [[1, 12, 0, 0], [8]],
            [[1, 12, 0, 1], [8]],  // ET : 8 & 12
            [[2, 3, 0, 0], [8]],
            [[2, 3, 0, 1], [11]],  // OU : 8 | 3
            [[3, 0, 0, 0], [11]],
            [[3, 0, 0, 1], [4]],   // NON : ~11 → 4
            [[0, 1, 1, 0], [0]],   // Reset
          ],
        },
      },
    ],
  },

  {
    id: 'plus-loin',
    title: 'Pour aller plus loin',
    levels: [
      {
        id: 'mux2to1',
        title: 'Multiplexeur 2→1',
        description:
          'Un multiplexeur est un aiguillage : selon le sélecteur S, il laisse passer A (si S = 0) '
          + 'ou B (si S = 1). Construis-le avec les portes de base : Y = (A ET NON S) OU (B ET S). '
          + 'Ordre des entrées : A, B, S. Sortie : Y.',
        allowedTypes: ['INPUT', 'OUTPUT', 'AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'],
        inputs: [{ name: 'A', width: 1 }, { name: 'B', width: 1 }, { name: 'S', width: 1 }],
        outputs: [{ name: 'Y', width: 1 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0, 0, 0], [0]],
          [[1, 0, 0], [1]],
          [[0, 1, 0], [0]],
          [[1, 1, 0], [1]],
          [[0, 0, 1], [0]],
          [[1, 0, 1], [0]],
          [[0, 1, 1], [1]],
          [[1, 1, 1], [1]],
        ],
      },
      {
        id: 'decoder2to4',
        title: 'Décodeur 2→4',
        description:
          'Un décodeur convertit un nombre de 2 bits en 4 lignes dont une seule est active. '
          + 'Pour l\'entrée AB (A = bit de poids fort), seule la sortie d\'indice AB vaut 1. '
          + 'Construis-le avec des AND et des NOT. Ordre des entrées : A, B. '
          + 'Ordre des sorties : Y0, Y1, Y2, Y3.',
        allowedTypes: ['INPUT', 'OUTPUT', 'AND', 'NOT', 'NAND', 'NOR'],
        inputs: [{ name: 'A', width: 1 }, { name: 'B', width: 1 }],
        outputs: [
          { name: 'Y0', width: 1 }, { name: 'Y1', width: 1 },
          { name: 'Y2', width: 1 }, { name: 'Y3', width: 1 },
        ],
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
        description:
          'Compare deux nombres de 2 bits A (= A1 A0) et B (= B1 B0), avec A1 et B1 en bits de '
          + 'poids fort. Trois sorties : ALT (A < B), AEQ (A = B), AGT (A > B). '
          + 'Ordre des entrées : A1, A0, B1, B0. Ordre des sorties : ALT, AEQ, AGT.',
        allowedTypes: ['INPUT', 'OUTPUT', 'AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'],
        inputs: [
          { name: 'A1', width: 1 }, { name: 'A0', width: 1 },
          { name: 'B1', width: 1 }, { name: 'B0', width: 1 },
        ],
        outputs: [{ name: 'ALT', width: 1 }, { name: 'AEQ', width: 1 }, { name: 'AGT', width: 1 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0, 0, 0, 0], [0, 1, 0]],
          [[0, 0, 0, 1], [1, 0, 0]],
          [[0, 1, 0, 1], [0, 1, 0]],
          [[1, 0, 0, 1], [0, 0, 1]],
          [[1, 1, 1, 0], [0, 0, 1]],
          [[1, 1, 1, 1], [0, 1, 0]],
        ],
      },
    ],
  },
];

// Récupère un chapitre par ID
export function getChapter(chapterId) {
  return CHAPTERS.find((ch) => ch.id === chapterId);
}

// Récupère un niveau par chapitre et ID
export function getLevel(chapterId, levelId) {
  const chapter = getChapter(chapterId);
  return chapter ? chapter.levels.find((l) => l.id === levelId) : null;
}

// Liste plate de tous les niveaux (avec leur chapterId)
export function getAllLevels() {
  const all = [];
  for (const chapter of CHAPTERS) {
    for (const level of chapter.levels) {
      all.push({ ...level, chapterId: chapter.id });
    }
  }
  return all;
}
