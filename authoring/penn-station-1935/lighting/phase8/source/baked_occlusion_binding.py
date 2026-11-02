"""Bind fresh AO to all recognized exporter settings nodes after a rebake.

An imported glTF Material Output group can precede a newly created group. The
exporter may choose that first group, silently retaining the previous AO. Reuse
and update every existing recognized group's Occlusion input instead. Existing
material nodes and all links unrelated to Occlusion remain unchanged.
"""
import re
import bpy

def _recognized(node):
    if node.type != "GROUP" or not node.node_tree or "Occlusion" not in node.inputs:
        return False
    return re.sub(r"\.\d+$", "", node.node_tree.name) in {"glTF Material Output", "glTF Settings"}

def _link_key(link):
    return (link.from_node.as_pointer(), link.from_socket.identifier,
            link.to_node.as_pointer(), link.to_socket.identifier)

def bind_fresh_baked_occlusion(materials, ao_image, uv_name):
    records=[]
    for material in materials:
        nodes,links=material.node_tree.nodes,material.node_tree.links
        original=set(nodes);settings=[node for node in original if _recognized(node)]
        before={_link_key(link) for link in links
                if not(link.to_node in settings and link.to_socket.name=="Occlusion")}
        existing_count=len(settings)
        if not settings:
            group=bpy.data.node_groups.get("glTF Material Output")
            if group is None:
                group=bpy.data.node_groups.new("glTF Material Output","ShaderNodeTree")
                group.interface.new_socket(name="Occlusion",in_out="INPUT",socket_type="NodeSocketFloat")
            node=nodes.new("ShaderNodeGroup");node.node_tree=group
            if "Occlusion"not in node.inputs:raise RuntimeError("Existing glTF settings group lacks an Occlusion input")
            settings=[node]
        uv=nodes.new("ShaderNodeUVMap");uv.uv_map=uv_name
        texture=nodes.new("ShaderNodeTexImage");texture.image=ao_image
        links.new(uv.outputs["UV"],texture.inputs["Vector"])
        for node in settings:
            for link in list(node.inputs["Occlusion"].links):links.remove(link)
            links.new(texture.outputs["Color"],node.inputs["Occlusion"])
        assert original.issubset(set(nodes)),"An existing material node was removed"
        after={_link_key(link) for link in links
               if link.from_node in original and link.to_node in original
               and not(link.to_node in settings and link.to_socket.name=="Occlusion")}
        assert before==after,"A non-AO original material link changed"
        assert all(len(node.inputs["Occlusion"].links)==1 and
                   node.inputs["Occlusion"].links[0].from_node == texture for node in settings)
        records.append({"material":material.name,"existingSettingsGroups":existing_count,
                        "updatedSettingsGroups":len(settings),"aoImage":ao_image.name,
                        "uvName":uv_name,"allExistingNodesRetained":True,
                        "allNonAoOriginalLinksExact":True})
    return {"schema":1,"status":"PASS","method":"Reuse/update every recognized Occlusion settings input; create only when absent",
            "freshAoImage":ao_image.name,"materials":records}
