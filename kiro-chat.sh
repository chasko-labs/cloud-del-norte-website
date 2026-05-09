#!/bin/bash
SESSION="ugwebsite"
DIR="$HOME/code/chasko-labs/cloud-del-norte-website"
AGENT="poltergeist-liora-moodle-ux"
HAUNTING_DIR="$HOME/code/heraldstack/haunting-kiro-cli"

cd "$HAUNTING_DIR" && git pull --rebase --quiet 2>/dev/null || true
./deploy.sh

tmux kill-session -t "$SESSION" 2>/dev/null || true
tmux new-session -d -s "$SESSION" -c "$DIR" "kiro-cli chat --classic --agent $AGENT; tmux kill-session -t $SESSION"
tmux attach-session -t "$SESSION"
