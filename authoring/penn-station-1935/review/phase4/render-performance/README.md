# Quiet GPU performance investigation

These are measured diagnostic controls on the pre-repair visual candidate, in Chrome156 on Apple M5 Max. They are not universal device certification or final repaired-asset acceptance. All six zones stayed loaded. The matched original-to-pair control records40.6 to59.3 render submissions per second,49.93M to20.13M submitted triangles and443 to146draws. GPU query durations and render-submission rate are reported separately.

The accepted pair is static shadow caching plus front-face rendering for the exact closed square-prism glass material. Transmission, refraction resolution and thin window glazing remain intact. The later cache lifecycle review tests the production helper and projection refresh separately.

Only the clean matched control image pair is duplicated here. Full native-retina and other investigation images remain in the persistent work folders identified by the original reports. Later retina screenshots already contained the front-face change in both variants, as disclosed in the source summary.
