#!/bin/bash
cd /e/活人感2079-重制版
export HTTPS_PROXY=http://127.0.0.1:10808 TRIPO_ANALYTICS_ENABLED=0 TRIPO_NO_UPDATE_CHECK=1
run() {
  local name="$1" fl="$2" prompt="$3"
  echo "=== START $name $(date +%T) ==="
  tripo make "$prompt" --model tripo-v3.1 -p face_limit=$fl -p pbr=true -p texture_quality=standard -o tripo-out --name "$name" --json --yes > "tripo-out/$name.result.json" 2> "tripo-out/$name.log"
  echo "=== END $name exit=$? $(date +%T) ==="
}
run bigapple_statue 12000 'cartoon bronze statue of a chubby frog holding a coffee cup aloft like the Statue of Liberty, green patina, stylized funny game landmark, full body on small pedestal'
run yellow_taxi 8000 'stylized cartoon New York yellow taxi cab, chunky proportions, roof taxi sign, black checkered stripe, game prop'
run lifeguard_tower 10000 'cartoon beach lifeguard tower, red and white wooden stilt cabin, railing, ladder, small roof, game prop'
run flamingo_float 8000 'inflatable pink flamingo pool float, cartoon glossy vinyl, ride-on ring shape, game prop'
run tokyo_lucky_cat 8000 'Japanese maneki-neko lucky cat statue, white ceramic, red collar, gold coin, one paw raised, cartoon style, game prop'
echo BATCH_DONE
