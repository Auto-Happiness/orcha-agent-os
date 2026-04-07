import { NextRequest, NextResponse } from "next/server";
import { DatabaseScanner } from "@/lib/db/introspection";

export async function POST(req: NextRequest) {
  try {
    const { type, config, sql } = await req.json();

    if (!type || !config || !sql) {
      return NextResponse.json({ success: false, message: "Missing required parameters (type, config, sql)." }, { status: 400 });
    }

    const { rows, columns } = await DatabaseScanner.executeQuery(type, config, sql);

    return NextResponse.json({ 
      success: true, 
      rows,
      columns,
      rowCount: rows.length
    });

  } catch (error: any) {
    console.error("Query execution error:", error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || "An error occurred during SQL execution." 
    }, { status: 500 });
  }
}
