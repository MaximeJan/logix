import { Trophy } from 'lucide-react';
import { getLevel } from '../challenges';
import { GATES } from '../gates';

interface Port {
  name: string;
  width: number;
}

interface ChallengeBannerProps {
  chapterId: string;
  levelId: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const fmtPorts = (ports: Port[]) =>
  ports.map((p) => `${p.name} (${p.width} bit${p.width > 1 ? 's' : ''})`).join(', ');

// Bandeau de consigne du challenge, au-dessus du canevas (repliable). Énonce le
// titre, l'objectif, les étapes, et les ports d'entrée/sortie attendus. Sert de
// référence pendant la résolution ; la vérification se fait depuis le panneau gauche.
export function ChallengeBanner({
  chapterId,
  levelId,
  collapsed,
  onToggleCollapsed,
}: ChallengeBannerProps) {
  const lvl = getLevel(chapterId, levelId);
  if (!lvl) return null;
  const compLabels = lvl.allowedTypes
    .filter((t: string) => t !== 'INPUT' && t !== 'OUTPUT')
    .map((t: string) => GATES[t]?.label ?? t);

  return (
    <div className="absolute top-0 left-0 right-0 z-20 bg-sky-50 border-b border-sky-200 shadow-sm max-h-[55%] overflow-y-auto">
      <div className="px-4 py-2">
        <div className="flex items-start gap-2">
          <Trophy size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-stone-800">{lvl.title}</div>
            <div className="text-sm text-stone-700">{lvl.objective}</div>
          </div>
          <button
            onClick={onToggleCollapsed}
            className="shrink-0 text-xs font-medium text-sky-700 hover:text-sky-900 px-1.5 py-0.5 rounded hover:bg-sky-100"
          >
            {collapsed ? 'Afficher la consigne ▾' : 'Masquer ▴'}
          </button>
        </div>

        {!collapsed && (
          <div className="mt-2 flex flex-wrap gap-x-8 gap-y-2">
            <ol className="flex-1 min-w-[280px] list-decimal pl-5 text-sm text-stone-700 space-y-0.5 marker:text-sky-600 marker:font-semibold">
              {(lvl.steps ?? []).map((s: string, i: number) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <div className="text-xs text-stone-600 space-y-1 max-w-[260px]">
              {compLabels.length > 0 && (
                <div>
                  <span className="font-semibold text-stone-700">Composants à utiliser : </span>
                  {compLabels.join(', ')}
                </div>
              )}
              <div>
                <span className="font-semibold text-stone-700">
                  Entrées à créer (dans l'ordre) :{' '}
                </span>
                {fmtPorts(lvl.inputs)}
              </div>
              <div>
                <span className="font-semibold text-stone-700">Sorties à créer : </span>
                {fmtPorts(lvl.outputs)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
