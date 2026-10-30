"""Choose an available Cycles device without saving application preferences."""
import bpy


def configure_device(scene, requested="AUTO"):
    requested = requested.upper()
    if requested not in {"AUTO", "CPU", "METAL"}:
        raise ValueError("Device must be AUTO, CPU or METAL")
    if requested != "CPU":
        preferences = bpy.context.preferences.addons["cycles"].preferences
        available = {item[0] for item in preferences.get_device_types(bpy.context)}
        if "METAL" in available:
            preferences.compute_device_type = "METAL"
            preferences.get_devices()
            devices = [device for device in preferences.devices if device.type == "METAL"]
            if devices:
                for device in preferences.devices:
                    device.use = device.type == "METAL"
                scene.cycles.device = "GPU"
                return {"requested": requested, "backend": "METAL", "devices": [device.name for device in devices]}
        if requested == "METAL":
            raise RuntimeError("No Metal render device is available")
    scene.cycles.device = "CPU"
    return {"requested": requested, "backend": "CPU", "devices": ["CPU"]}
