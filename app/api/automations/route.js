import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// GET all automations
export async function GET() {
  const { data, error } = await supabase
    .from("automations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

// POST create automation
export async function POST(req) {
  const body = await req.json();

  const { data, error } = await supabase
    .from("automations")
    .insert([{
      name: body.name,
      workspace: body.workspace,
      field: body.field,
      event: body.event,
      if_enabled: body.ifEnabled,
      if_field: body.ifField || null,
      operator: body.operator || null,
      if_value: body.ifValue || null,
      action1: body.action1,
      action2: body.action2 || null,
      active: true,
    }])
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}

// PATCH toggle active
export async function PATCH(req) {
  const body = await req.json();
  const { data, error } = await supabase
    .from("automations")
    .update({ active: body.active })
    .eq("id", body.id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

// DELETE
export async function DELETE(req) {
  const { id } = await req.json();
  const { error } = await supabase
    .from("automations")
    .delete()
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
