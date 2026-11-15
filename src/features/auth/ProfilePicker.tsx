import { useNavigate } from 'react-router-dom';
import { useProfileStore } from '@/stores/profileStore';
import { useSessionStore } from '@/stores/sessionStore';

const TILE = ['bg-der/15 text-der', 'bg-die/15 text-die', 'bg-das/15 text-das'];

export function ProfilePicker() {
  const { profiles, currentId, select } = useProfileStore();
  const resetSession = useSessionStore((s) => s.reset);
  const navigate = useNavigate();

  const choose = async (id: string) => {
    if (id !== currentId) resetSession();
    await select(id);
    navigate('/', { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-full max-w-[480px] flex-col justify-center gap-8 px-6">
      <h1 className="text-center text-3xl font-bold">Kto się uczy?</h1>
      <div className="grid grid-cols-2 gap-4">
        {profiles.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => choose(p.id)}
            className={`flex aspect-square flex-col items-center justify-center gap-3 rounded-3xl ring-1 ring-muted/10 active:scale-95 ${p.id === currentId ? 'ring-2 ring-accent' : ''} bg-surface`}
          >
            <span className={`flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold ${TILE[i % TILE.length]}`}>
              {p.displayName.slice(0, 1)}
            </span>
            <span className="text-lg font-semibold">{p.displayName}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
