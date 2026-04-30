// placeholder — implementation provided separately
// module-level singleton guard: second mount() call is a no-op
let mounted = false;

export function mount(): () => void {
	if (mounted) return () => {};
	mounted = true;
	return () => {
		mounted = false;
	};
}
