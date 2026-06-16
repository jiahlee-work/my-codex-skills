# repo-tooling lint-staged start
if [ -f pnpm-lock.yaml ] && command -v pnpm >/dev/null 2>&1; then
  pnpm exec lint-staged
elif { [ -f bun.lockb ] || [ -f bun.lock ]; } && command -v bun >/dev/null 2>&1; then
  bunx lint-staged
elif [ -f yarn.lock ] && command -v yarn >/dev/null 2>&1; then
  yarn lint-staged
else
  npx --no -- lint-staged
fi
# repo-tooling lint-staged end
