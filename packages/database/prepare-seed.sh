#!/bin/bash
set -e

cd "$(dirname "$0")"

# Creates required folders and removes .keep files to avoid mime-type errors during seed

for bucket in $(grep -oP '\[storage\.buckets\.\K[^\]]+' supabase/config.toml); do
  path=$(awk -v b="$bucket" '
    $0 ~ "\\[storage\\.buckets\\." b "\\]" { found=1 }
    found && $1 == "objects_path" { gsub(/"/, "", $3); print $3; exit }
  ' supabase/config.toml)
  
  if [ -n "$path" ]; then
    folder="supabase/${path#./}"
    mkdir -p "$folder"
    
    echo "Downloading remote bucket '$bucket'..."
    temp_dir=$(mktemp -d)
    
    # Supabase CLI creates a subfolder for the bucket inside the target directory
    npx --yes supabase storage cp --experimental --linked -r "ss:///$bucket/" "$temp_dir/" || true
    
    # Copy the contents directly into the target folder to avoid nesting
    if [ -d "$temp_dir/$bucket" ]; then
      cp -a "$temp_dir/$bucket/." "$folder/"
    fi
    
    rm -rf "$temp_dir"
    rm -f "$folder/.keep"
  fi
done

# Strip out storage.buckets inserts from seed.sql because config.toml already creates them 
# and running an INSERT during seed will crash with a unique key constraint.
perl -0777 -pi -e 's/INSERT INTO "storage"\."buckets".*?;//gs' supabase/seed.sql

# The linked Storage schema can be newer than the local Storage image.
perl -0777 -pi -e '
  my $start = index($_, q{INSERT INTO "storage"."objects"});
  if ($start >= 0) {
    my $end = index($_, q{;}, $start);
    my $block = substr($_, $start, $end - $start);
    $block =~ s/, "archived_at", "is_delete_marker", "is_versioned"//;
    $block =~ s/, (?:NULL|\x27(?:\x27\x27|[^\x27])*\x27), (?:true|false), (?:true|false)(?=\),?)/ /g;
    substr($_, $start, $end - $start) = $block;
  }
' supabase/seed.sql
