package com.campusexam.util;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

/**
 * Pure Java OpenXML (.xlsx) Workbook Parser.
 * Uses standard JDK java.util.zip and javax.xml.parsers with zero external dependencies.
 */
public final class ExcelParser {

    private ExcelParser() {}

    /**
     * Parses an .xlsx byte array into a list of row cells (0-based index).
     */
    public static List<List<String>> parseXlsx(byte[] bytes) throws Exception {
        if (bytes == null || bytes.length < 30) {
            throw new IllegalArgumentException("Invalid Excel workbook: File is empty or too small");
        }

        Map<String, byte[]> zipEntries = new HashMap<>();
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                int n;
                while ((n = zis.read(buf)) != -1) {
                    baos.write(buf, 0, n);
                }
                zipEntries.put(entry.getName().replace("\\", "/"), baos.toByteArray());
            }
        }

        if (zipEntries.isEmpty() || !zipEntries.containsKey("[Content_Types].xml")) {
            throw new IllegalArgumentException("Invalid Excel workbook: Not a valid .xlsx archive");
        }

        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
        dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        DocumentBuilder db = dbf.newDocumentBuilder();

        // 1. Parse shared strings if present
        List<String> sharedStrings = new ArrayList<>();
        byte[] sstBytes = zipEntries.get("xl/sharedStrings.xml");
        if (sstBytes != null) {
            Document doc = db.parse(new ByteArrayInputStream(sstBytes));
            NodeList siList = doc.getElementsByTagName("si");
            for (int i = 0; i < siList.getLength(); i++) {
                Element si = (Element) siList.item(i);
                NodeList tList = si.getElementsByTagName("t");
                StringBuilder sb = new StringBuilder();
                for (int j = 0; j < tList.getLength(); j++) {
                    sb.append(tList.item(j).getTextContent());
                }
                sharedStrings.add(sb.toString());
            }
        }

        // 2. Parse sheet1.xml (or first available sheet)
        byte[] sheetBytes = zipEntries.get("xl/worksheets/sheet1.xml");
        if (sheetBytes == null) {
            for (String k : zipEntries.keySet()) {
                if (k.startsWith("xl/worksheets/sheet") && k.endsWith(".xml")) {
                    sheetBytes = zipEntries.get(k);
                    break;
                }
            }
        }

        if (sheetBytes == null) {
            throw new IllegalArgumentException("Invalid Excel workbook: No worksheet found");
        }

        Document sheetDoc = db.parse(new ByteArrayInputStream(sheetBytes));
        NodeList rowList = sheetDoc.getElementsByTagName("row");
        List<List<String>> result = new ArrayList<>();

        for (int i = 0; i < rowList.getLength(); i++) {
            Element rowEl = (Element) rowList.item(i);
            NodeList cList = rowEl.getElementsByTagName("c");
            List<String> rowCells = new ArrayList<>();
            int expectedCol = 0;

            for (int j = 0; j < cList.getLength(); j++) {
                Element c = (Element) cList.item(j);
                String cellRef = c.getAttribute("r"); // e.g. "A1", "B2"
                String cellType = c.getAttribute("t"); // "s" for shared string, "inlineStr", or "" for number

                int colIdx = getColIndex(cellRef);
                while (expectedCol < colIdx) {
                    rowCells.add("");
                    expectedCol++;
                }

                String val = "";
                NodeList vList = c.getElementsByTagName("v");
                if (vList.getLength() > 0) {
                    String rawV = vList.item(0).getTextContent();
                    if ("s".equals(cellType)) {
                        try {
                            int sIdx = Integer.parseInt(rawV);
                            if (sIdx >= 0 && sIdx < sharedStrings.size()) {
                                val = sharedStrings.get(sIdx);
                            }
                        } catch (Exception ignored) {
                            val = rawV;
                        }
                    } else {
                        val = rawV;
                    }
                } else {
                    NodeList isList = c.getElementsByTagName("is");
                    if (isList.getLength() > 0) {
                        val = isList.item(0).getTextContent();
                    }
                }
                rowCells.add(val != null ? val.trim() : "");
                expectedCol++;
            }

            // Omit completely empty trailing rows
            boolean allEmpty = true;
            for (String cell : rowCells) {
                if (cell != null && !cell.isBlank()) {
                    allEmpty = false;
                    break;
                }
            }
            if (!allEmpty || !result.isEmpty()) {
                result.add(rowCells);
            }
        }

        // Remove trailing empty rows
        while (!result.isEmpty()) {
            List<String> lastRow = result.get(result.size() - 1);
            boolean allEmpty = true;
            for (String cell : lastRow) {
                if (cell != null && !cell.isBlank()) {
                    allEmpty = false;
                    break;
                }
            }
            if (allEmpty) {
                result.remove(result.size() - 1);
            } else {
                break;
            }
        }

        return result;
    }

    /**
     * Converts a cell reference string like "A1", "BC12" to 0-based column index.
     */
    public static int getColIndex(String cellRef) {
        if (cellRef == null || cellRef.isEmpty()) return 0;
        int col = 0;
        for (int i = 0; i < cellRef.length(); i++) {
            char ch = cellRef.charAt(i);
            if (Character.isLetter(ch)) {
                col = col * 26 + (Character.toUpperCase(ch) - 'A' + 1);
            } else {
                break;
            }
        }
        return Math.max(0, col - 1);
    }

    /**
     * Normalizes DOB string into ISO YYYY-MM-DD.
     * Supports YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, and Excel serial date numbers.
     */
    public static String normalizeDob(String raw) {
        if (raw == null || raw.isBlank()) return "";
        String s = raw.trim();

        // Check for Excel serial date (e.g. 38000 = 2004-01-15)
        if (s.matches("^\\d{4,5}(\\.\\d+)?$")) {
            try {
                double serial = Double.parseDouble(s);
                if (serial >= 1000 && serial <= 80000) {
                    // Excel day 1 is 1900-01-01, with leap year bug for 1900-02-29
                    long days = (long) Math.floor(serial);
                    if (days > 60) days--; // leap year adjustment
                    LocalDate date = LocalDate.of(1900, 1, 1).plusDays(days - 1);
                    return date.format(DateTimeFormatter.ISO_LOCAL_DATE);
                }
            } catch (Exception ignored) {}
        }

        // Remove time suffix if present
        s = s.replaceAll("[T\\s].*$", "").trim();

        // DD-MM-YYYY or DD/MM/YYYY
        if (s.matches("^\\d{1,2}[-/]\\d{1,2}[-/]\\d{4}$")) {
            String[] parts = s.split("[-/]");
            int d = Integer.parseInt(parts[0]);
            int m = Integer.parseInt(parts[1]);
            int y = Integer.parseInt(parts[2]);
            return String.format("%04d-%02d-%02d", y, m, d);
        }

        // YYYY-MM-DD or YYYY/MM/DD
        if (s.matches("^\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}$")) {
            String[] parts = s.split("[-/]");
            int y = Integer.parseInt(parts[0]);
            int m = Integer.parseInt(parts[1]);
            int d = Integer.parseInt(parts[2]);
            return String.format("%04d-%02d-%02d", y, m, d);
        }

        return s;
    }
}
