#!/bin/bash

# Check if a commit hash was provided
if [ -z "$1" ]; then
    echo "Usage: $0 <starting_commit_hash> [end_date]"
    echo "End date format: YYYY-MM-DD HH:MM:SS (e.g. '2023-08-15 14:30:00')"
    echo "If end_date is not provided, random gaps will be used"
    exit 1
fi

START_COMMIT=$1
END_DATE_SPECIFIED=false

# Check if an end date was provided
if [ ! -z "$2" ]; then
    END_DATE_SPECIFIED=true
    END_DATE=$(date -j -f "%Y-%m-%d %H:%M:%S" "$2" "+%s" 2>/dev/null)
    if [ $? -ne 0 ]; then
        echo "Error: Invalid date format. Please use YYYY-MM-DD HH:MM:SS"
        exit 1
    fi
fi

# Get the number of commits to rewrite
COMMIT_COUNT=$(git rev-list --count $START_COMMIT..HEAD)

# Create a temporary script for rewriting commit dates
TEMP_SCRIPT=$(mktemp)
chmod +x "$TEMP_SCRIPT"

# Generate a script with the appropriate date calculation logic
if [ "$END_DATE_SPECIFIED" = true ]; then
    # Pass the end date and commit count to the script
    cat > "$TEMP_SCRIPT" << EOF
#!/bin/bash

# End date in Unix timestamp
END_DATE=$END_DATE

# Total number of commits
COMMIT_COUNT=$COMMIT_COUNT

# Get current commit number in the rebase sequence
CURRENT_COMMIT=\$(git rev-list --count $START_COMMIT..HEAD)

# Get the starting commit date
START_DATE=\$(git show -s --format=%at $START_COMMIT)

# Calculate the total time span in seconds
TOTAL_SPAN=\$((END_DATE - START_DATE))

# Calculate average gap and introduce high randomness
BASE_GAP=\$((TOTAL_SPAN / (COMMIT_COUNT + 1)))

# Generate a more random distribution
# Use a higher randomness factor - up to 60% deviation from the base gap
RANDOM_FACTOR=\$((BASE_GAP * 6 / 10))
RANDOM_OFFSET=\$((RANDOM % (2 * RANDOM_FACTOR) - RANDOM_FACTOR))

# Add exponential randomness factor occasionally (1 in 3 chance)
if [ \$((RANDOM % 3)) -eq 0 ]; then
    # Add an extra boost of randomness (up to 2x the regular random factor)
    EXTRA_RANDOM=\$((RANDOM % RANDOM_FACTOR * 2))

    # Flip a coin to decide if we add or subtract the extra randomness
    if [ \$((RANDOM % 2)) -eq 0 ]; then
        RANDOM_OFFSET=\$((RANDOM_OFFSET + EXTRA_RANDOM))
    else
        RANDOM_OFFSET=\$((RANDOM_OFFSET - EXTRA_RANDOM))
    fi
fi

# Calculate the new date with high variability
NEW_DATE=\$((START_DATE + (BASE_GAP * CURRENT_COMMIT) + RANDOM_OFFSET))

# Ensure we don't exceed the end date
if [ \$NEW_DATE -gt \$END_DATE ]; then
    # More random fallback (between 1 minute and 4 hours before end date)
    NEW_DATE=\$((END_DATE - (RANDOM % 14340 + 60)))
fi

# Ensure we don't go before the previous commit
PREV_COMMIT_DATE=\$(git log -2 --format=%at | tail -n 1 2>/dev/null || echo \$START_DATE)
if [ \$NEW_DATE -le \$PREV_COMMIT_DATE ]; then
    # Add a small random gap (10-120 minutes)
    NEW_DATE=\$((PREV_COMMIT_DATE + RANDOM % 6600 + 600))
fi

# Amend the commit with the new date
GIT_COMMITTER_DATE="@\$NEW_DATE" GIT_AUTHOR_DATE="@\$NEW_DATE" git commit --amend --no-edit --date="@\$NEW_DATE"
EOF
else
    # Use the original random gap approach with increased randomness
    cat > "$TEMP_SCRIPT" << 'EOF'
#!/bin/bash

# Define the minimum and maximum gap in seconds with high variability
MIN_GAP=900    # 15 minutes
MAX_GAP=43200  # 12 hours

# Get the previous commit date
if git log -2 --format=%at | tail -n 1 > /dev/null 2>&1; then
    PREV_DATE=$(git log -2 --format=%at | tail -n 1)
else
    # First commit in the rebase, use starting date
    PREV_DATE=$(git log HEAD --format=%at | head -n 1)
fi

# Generate a highly variable random gap
# Base randomness
RANDOM_GAP=$((RANDOM % (MAX_GAP - MIN_GAP) + MIN_GAP))

# Add exponential randomness occasionally (1 in 4 chance)
if [ $((RANDOM % 4)) -eq 0 ]; then
    # Add or subtract up to 50% more randomness
    EXTRA_RANDOM=$((RANDOM % (RANDOM_GAP / 2)))

    # Flip a coin to decide if we add or subtract
    if [ $((RANDOM % 2)) -eq 0 ]; then
        RANDOM_GAP=$((RANDOM_GAP + EXTRA_RANDOM))
    else
        RANDOM_GAP=$((RANDOM_GAP - EXTRA_RANDOM / 2))
    fi
fi

# Make sure we still respect minimum gap
if [ $RANDOM_GAP -lt $MIN_GAP ]; then
    RANDOM_GAP=$MIN_GAP
fi

# Calculate new date
NEW_DATE=$((PREV_DATE + RANDOM_GAP))

# Amend the commit with the new date
GIT_COMMITTER_DATE="@$NEW_DATE" GIT_AUTHOR_DATE="@$NEW_DATE" git commit --amend --no-edit --date="@$NEW_DATE"
EOF
fi

# Start interactive rebase
echo "Starting interactive rebase. Will execute date-changing script for each commit."
echo "Please save and close the editor when it opens."

# Determine if the START_COMMIT is the root commit
if git rev-parse --verify "${START_COMMIT}^" >/dev/null 2>&1; then
    # Not the root commit, rebase from parent
    git rebase -i "${START_COMMIT}^" --exec "$TEMP_SCRIPT"
else
    # Root commit, use --root
    git rebase -i --root --exec "$TEMP_SCRIPT"
fi

# Clean up
rm "$TEMP_SCRIPT"

echo "Commit dates have been rewritten successfully!"