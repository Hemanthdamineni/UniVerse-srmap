import sys

with open('src/pages/Dashboard/InternalMarks.tsx', 'r') as f:
    lines = f.readlines()

out = []
# we need to replace lines 4 through 80 with the import statement
for i, line in enumerate(lines):
    if i == 3:
        out.append('import { transformInternalMarks, type InternalMarkSubject } from "../../lib/erpTransformers";\n')
        out.append('\n')
        out.append('interface ProcessedData {\n')
        out.append('  subjects: InternalMarkSubject[];\n')
        out.append('  pieData: Array<{ name: string; value: number; color: string }>;\n')
        out.append('  averagePercentage: number;\n')
        out.append('  detailTables: any[];\n')
        out.append('  rawRows: any[];\n')
        out.append('}\n')
    elif 4 <= i <= 80:
        pass # skip local Interface, extractSubjects, normalizeInternalMarksSource
    elif i == 82: # function InternalMarks({ marksData }: { marksData?: any }) {
        out.append(line)
    elif i == 83: # const [selectedCourse, setSelectedCourse] = useState<Subject | null>(null);
        out.append('  const [selectedCourse, setSelectedCourse] = useState<InternalMarkSubject | null>(null);\n')
    elif 85 <= i <= 118:
        if i == 85:
            # We replace from line 85 (const processedData = useMemo...) until line 118
            out.append("""  const processedData = useMemo<ProcessedData | null>(() => {
    const transformed = transformInternalMarks(marksData);
    if (!transformed) return null;

    const { subjects, averagePercentage } = transformed;

    const pieData = [
      {
        name: "Excellent (>=80%)",
        value: subjects.filter((subject) => subject.percentage >= 80).length,
        color: "var(--success)",
      },
      {
        name: "Good (60-79%)",
        value: subjects.filter((subject) => subject.percentage >= 60 && subject.percentage < 80).length,
        color: "var(--warning)",
      },
      {
        name: "Needs Improvement (<60%)",
        value: subjects.filter((subject) => subject.percentage < 60).length,
        color: "var(--error)",
      },
    ].filter((item) => item.value > 0);

    return {
      subjects,
      pieData,
      averagePercentage,
      detailTables: [],
      rawRows: [],
    };
  }, [marksData]);
""")
    else:
        out.append(line)

with open('src/pages/Dashboard/InternalMarks.tsx', 'w') as f:
    f.writelines(out)
