# Exact historical transport retention

Four unreferenced historical KTX transport files totaling4,898,029bytes are retained through immutable Git and verified external copies in retired-unused-ktx.json. All12currentGLBimage arrays/materialextras and active auxiliary/text references were checked before retirement. Current used textures, source PNGs/HDRs, canonical scenes and QA images were retained. Run restore-unused-ktx.py with an explicit repository path for exact historical replay; it refuses differing existing files.
