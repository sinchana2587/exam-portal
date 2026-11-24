-- 1. Ensure Subjects in Department 2 (CSE)

INSERT INTO subject (code, name, department_id, semester, applicable_sections)
VALUES 
  ('MH25CS003', 'OS', 2, 5, ARRAY['Section A', 'Section B']),
  ('21CS52', 'Data Structures and Algorithms', 2, 5, ARRAY['Section A', 'Section B']),
  ('21CS53', 'Logic Design & Computer Organization', 2, 5, ARRAY['Section A', 'Section B']),
  ('21CS32', 'Data Structures and Algorithms', 2, 3, ARRAY['Section A', 'Section B']),
  ('21CS33', 'Logic Design & Computer Organization', 2, 3, ARRAY['Section A', 'Section B'])
ON CONFLICT (code) DO UPDATE 
SET applicable_sections = EXCLUDED.applicable_sections,
    name = EXCLUDED.name;


DO $$
DECLARE
    v_sub_id bigint;
    v_bank_id bigint;
    v_creator_id bigint;
BEGIN
    SELECT id INTO v_sub_id FROM subject WHERE code = '21CS52' LIMIT 1;
    SELECT id INTO v_creator_id FROM account WHERE username = 'hod.cse' LIMIT 1;
    IF v_creator_id IS NULL THEN
        SELECT id INTO v_creator_id FROM account WHERE role = 'HOD' LIMIT 1;
    END IF;
    IF v_creator_id IS NULL THEN
        v_creator_id := 1;
    END IF;

    -- Ensure question_bank header
    SELECT id INTO v_bank_id FROM question_bank 
    WHERE subject_id = v_sub_id AND department_id = 2 AND semester = 5 LIMIT 1;

    IF v_bank_id IS NULL THEN
        INSERT INTO question_bank (department_id, subject_id, academic_session, semester, title, created_by, state, total_questions)
        VALUES (2, v_sub_id, '2025-26', 5, 'Data Structures & Algorithms Question Bank (150 MCQs)', v_creator_id, 'FINALIZED', 150)
        RETURNING id INTO v_bank_id;
    ELSE
        UPDATE question_bank SET total_questions = 150, state = 'FINALIZED' WHERE id = v_bank_id;
    END IF;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q001', 1, 'According to the notes, a data structure can be expressed as:', ARRAY['Data Structure = Organized data + Allowed operations', 'Data Structure = Algorithm + Flowchart', 'Data Structure = Program + Compiler', 'Data Structure = Input + Output'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q002', 1, 'A field K whose values uniquely determine a record in a file is called a:', ARRAY['Primary key', 'Group item', 'Entity set', 'Variable-length record'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q003', 1, 'Which of the following is a primitive data structure?', ARRAY['Array', 'Integer', 'Tree', 'Graph'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q004', 1, 'Which of the following is a non-linear data structure?', ARRAY['Stack', 'Queue', 'Linked list', 'Tree'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q005', 1, 'In data structure operations, merging means:', ARRAY['Arranging all data items in ascending or descending order', 'Combining the data items of two sorted lists into a single list', 'Finding whether a desired data item is present in a list', 'Reserving memory for the program elements'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q006', 1, 'A pointer is:', ARRAY['A variable that can store only integer constants', 'A special variable that contains the address of a memory location', 'A function that allocates memory at run time', 'A data type that stores a sequence of characters'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q007', 1, 'A pointer that has not been initialized with a valid address is known as a:', ARRAY['NULL pointer', 'Void pointer', 'Dangling (wild) pointer', 'Pointer to pointer'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q008', 1, 'Memory requested at run time using malloc() and calloc() is allocated from the:', ARRAY['Stack', 'Static (compile-time) data area', 'CPU registers', 'Heap'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q009', 1, 'Which dynamic memory allocation function initializes every allocated block to zero?', ARRAY['malloc()', 'realloc()', 'calloc()', 'free()'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q010', 1, 'Which statement correctly distinguishes calloc() from malloc()?', ARRAY['calloc() takes one argument and leaves the allocated memory uninitialized', 'calloc() takes two arguments (number of elements, element size) and initializes the memory to zero', 'calloc() releases previously allocated memory, while malloc() allocates it', 'calloc() allocates memory at compile time, while malloc() does it at run time'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q011', 1, 'If realloc() cannot extend an existing memory block in place, it:', ARRAY['Leaves the old block unchanged and returns a pointer to its first byte', 'Frees the old block and returns an uninitialized block without copying any data', 'Allocates a new block, copies the old contents into it and frees the old block', 'Always terminates the program with a run-time error'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q012', 1, 'What is the output of the following code? int a[5] = {10, 20, 30, 40, 50}; int *p = a; printf("%d %d", *(p + 2), 3[a]);', ARRAY['20 40', '30 30', 'Compilation error', '30 40'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q013', 1, 'Which declaration creates an array of 5 pointers to integers?', ARRAY['int *a;', 'int a[5];', 'int *a[5];', 'int **a;'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q014', 1, 'Binary search is applied on the sorted array {2, 5, 8, 12, 16, 23, 38, 56, 72, 91} with low = 0, high = 9 and mid = (low + high)/2 to find the key 23. How many times is mid computed before the key is found?', ARRAY['3', '2', '4', '5'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q015', 1, 'What is the output of the following code that inserts an item into an array? int a[10] = {5, 10, 15, 20}, n = 4, pos = 2, item = 12, i; for (i = n - 1; i >= pos; i--) a[i + 1] = a[i]; a[pos] = item; n = n + 1; for (i = 0; i < n; i++) printf("%d ", a[i]);', ARRAY['5 10 15 12 20', '5 10 12 15 20', '12 5 10 15 20', '5 10 12 20 20'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q016', 1, 'What is the output of the following code? int m[2][3] = { {1, 4, 2}, {3, 6, 8} }; int i, j, s = 0; for (i = 0; i < 2; i++) for (j = 0; j < 3; j++) if (i != j) s += m[i][j]; printf("%d", s);', ARRAY['24', '7', '21', '17'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q017', 1, 'To create a 2-D integer array of rows x cols dynamically using the pointer-to-pointer method of the notes, how many MALLOC (malloc) calls are needed in total?', ARRAY['1', 'rows x cols', 'rows + 1', 'cols + 1'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q018', 1, 'What is the output of the following code? int a = 10; int *p1 = &a; int **p2 = &p1; **p2 = **p2 + 5; printf("%d %d", a, *p1);', ARRAY['10 15', '15 10', '10 10', '15 15'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q019', 1, 'Which of the following structure definitions results in a syntax error?', ARRAY['struct str1 { int i; char c; } var1 = {10, ''A''};', 'struct str1 { int i = 10; char c = ''A''; };', 'struct str1 { int i; char c; }; struct str1 var1 = {10, ''A''};', 'struct str1 { int i; char c; float f; } s1, s2;'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q020', 1, 'Which of the following is a self-referential structure?', ARRAY['struct node { int data; struct node next; };', 'struct node { int data; int *next; };', 'struct node { int data; };', 'struct node { int data; struct node *next; };'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q021', 1, 'The size of a union is equal to the size of its:', ARRAY['Largest member', 'Smallest member', 'Sum of all members', 'First member'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q022', 1, 'Which statement about structures and unions is correct?', ARRAY['Altering one member of a structure alters the other members, but not in a union', 'In a structure each member has its own storage, whereas all members of a union share the same memory', 'A union allocates memory equal to the sum of the sizes of its members', 'All members of a union can be initialized at once, but only the first member of a structure can be'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q023', 1, 'Using the addpolynomial() logic of the notes (terms are stored in decreasing order of exponent and a term is attached only when its coefficient is non-zero), the sum of A(x) = 5x^3 + 4x^2 + 2 and B(x) = 3x^3 - 4x^2 + 7x is:', ARRAY['8x^3 + 0x^2 + 7x + 2', '8x^3 + 8x^2 + 7x + 2', '2x^3 + 8x^2 + 7x + 2', '8x^3 + 7x + 2'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q024', 1, 'A sparse matrix is a matrix that has:', ARRAY['A greater number of zero elements than non-zero elements', 'Only non-zero elements', 'More rows than columns', 'Non-zero elements only on its diagonal'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q025', 1, 'In the (row, column, value) triple representation of a sparse matrix, the first entry A[0] stores:', ARRAY['The first non-zero element of the matrix', 'The number of zero elements, rows and columns', 'The number of rows, the number of columns and the number of non-zero terms', 'The largest element and its row and column'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q026', 1, 'The 4 x 4 sparse matrix A shown below is stored as triples with B[0] = (4, 4, 5) for its transpose. Using the column-by-column transpose algorithm of the notes, what is B[4]? | 0  0  3  0 | A = | 0  0  0  8 | | 1  0  3  0 | | 0  0  7  0 |', ARRAY['(3, 1, 8)', '(2, 3, 7)', '(2, 2, 3)', '(0, 2, 1)'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q027', 1, 'For a sparse matrix with c columns and t non-zero terms, the transpose function of the notes (which scans all t terms once for every column) runs in time:', ARRAY['O(c x t)', 'O(c + t)', 'O(t)', 'O(c)'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q028', 1, 'A string in C is a sequence of characters terminated by the:', ARRAY['Null character ''\0''', 'Newline character ''\n''', 'Space character', 'Tab character ''\t'''], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q029', 1, 'What is the output of the following code? #include <string.h> char s[] = "Hello"; printf("%d", (int)(sizeof(s) + strlen(s)));', ARRAY['10', '12', '11', '5'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q030', 1, 'What is the output of the following code? char a[20] = "Data"; char b[] = "Struct"; strcat(a, b); printf("%s %d", a, (int)strlen(a));', ARRAY['DataStruct 10', 'DataStruct 11', 'StructData 10', 'Data 4'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q031', 2, 'In a stack, insertions (push) and deletions (pop) are made at one end called the:', ARRAY['Top', 'Front', 'Rear', 'Base'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q032', 2, 'Trying to push an element onto a stack that is already full is called:', ARRAY['Overflow', 'Underflow', 'Deadlock', 'Wrap-around'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q033', 2, 'Which auxiliary stack operation returns the last inserted element without removing it?', ARRAY['Pop()', 'Push()', 'Top()', 'Size()'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q034', 2, 'When a stack is implemented using an array, the value of top for an empty stack is initialized to:', ARRAY['-1', '0', '1', 'MAX_STACK_SIZE'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q035', 2, 'When a function is invoked, its stack frame placed on the system stack initially contains:', ARRAY['Only the local variables of the invoking function', 'The source code of the invoked function', 'A pointer to the previous stack frame and the return address', 'The final return value and an overflow flag'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q036', 2, 'For an array-based stack of size MAX_STACK_SIZE, the stack is full when:', ARRAY['top < 0', 'top >= MAX_STACK_SIZE - 1', 'top == MAX_STACK_SIZE', 'top == 0'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q037', 2, 'In the array-doubling strategy for a stack stored in a dynamic array, the total time spent on all array doublings over n push operations is:', ARRAY['O(n^2)', 'O(log n)', 'O(n)', 'O(n log n)'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q038', 2, 'In the infix-to-postfix algorithm using in-stack precedence (isp) and incoming precedence (icp), the left parenthesis has:', ARRAY['High in-stack precedence and low incoming precedence', 'Low in-stack precedence (isp = 0) but high incoming precedence (icp = 20)', 'Equal in-stack and incoming precedence of 0', 'Equal in-stack and incoming precedence of 20'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q039', 2, 'In which notation does the operator appear after its operands, as in A B +?', ARRAY['Postfix (reverse Polish) notation', 'Prefix (Polish) notation', 'Infix notation', 'Parenthesized infix notation'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q040', 2, 'The postfix form of the infix expression a*(b+c)*d is:', ARRAY['ab*c+d*', 'abcd+**', 'abc+*d*', 'abc*+d*'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q041', 2, 'The postfix form of the infix expression a+b*c-d/e is:', ARRAY['ab+c*de/-', 'abc*de/+-', 'abcde*/+-', 'abc*+de/-'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q042', 2, 'What is the value of the postfix expression 5 6 2 + * 12 4 / -?', ARRAY['37', '-37', '43', '3'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q043', 2, 'The prefix form of the infix expression (A + B) * C is:', ARRAY['+ A * B C', 'A B + C *', '* A + B C', '* + A B C'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q044', 2, 'Starting with an empty stack, the operations push(3), push(6), push(9), pop(), push(12), pop(), pop() are performed. What are the values returned by Top() and Size() now?', ARRAY['Top = 6, Size = 2', 'Top = 3, Size = 1', 'Top = 12, Size = 2', 'Top = 9, Size = 1'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q045', 2, 'What is the output of the following code? int stack[10], top = -1, x, y; stack[++top] = 4; stack[++top] = 7; stack[++top] = 2; x = stack[top--]; y = stack[top--]; stack[++top] = x * y; printf("%d %d", stack[top], top);', ARRAY['28 1', '14 1', '14 2', '14 0'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q046', 2, 'A stack uses a dynamically allocated array with an initial capacity of 1 and doubles the capacity (using realloc) whenever a push arrives while the array is full. What is the capacity after 9 pushes?', ARRAY['16', '9', '8', '18'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q047', 2, 'A queue works on which of the following principles?', ARRAY['Last-In-First-Out (LIFO)', 'Highest-priority-last', 'Random access', 'First-In-First-Out (FIFO)'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q048', 2, 'In the array implementation of a linear queue (with f initialized to 0 and r to -1), the queue is empty when:', ARRAY['f < r', 'f > r', 'r == QUEUESIZE - 1', 'f == QUEUESIZE - 1'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q049', 2, 'The figure shows a linear queue stored in an array with QUEUESIZE = 5, f = 2 and r = 4. What happens when insertQ(60, &r, q) is executed? q[ ] 0 1 30 2 40 3 50 4 f r', ARRAY['60 is stored at index 0', '60 is stored at index 5', 'It prints "Queue Empty"', 'It prints "queue overflow" even though locations 0 and 1 are empty'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q050', 2, 'In a circular queue implemented with an array of size QUEUESIZE, the rear is advanced during insertion using:', ARRAY['rear = rear + 1', 'rear = (rear - 1) % QUEUESIZE', 'rear = rear % QUEUESIZE + 1', 'rear = (rear + 1) % QUEUESIZE'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q051', 2, 'A circular queue (QUEUESIZE = 5) uses the variables f, r and count, initially f = 0, r = -1, count = 0. The operations performed are: insert 10, 20, 30, 40; delete twice; insert 50, 60, 70. The final values of f, r and count are:', ARRAY['f = 2, r = 1, count = 5', 'f = 2, r = 2, count = 5', 'f = 0, r = 1, count = 5', 'f = 2, r = 1, count = 3'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q052', 2, 'Elements 9, 4 and 6 are inserted, in this order, into an ascending priority queue. The order in which they are deleted is:', ARRAY['4, 6, 9', '9, 4, 6', '6, 4, 9', '9, 6, 4'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q053', 2, 'A priority queue is mainly used to implement:', ARRAY['Recursion', 'CPU scheduling algorithms', 'Binary search', 'Matrix multiplication'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q054', 2, 'In a deque (double-ended queue), insertion and deletion can be performed:', ARRAY['Only at the front end', 'At both the front and the rear ends', 'Only at the rear end', 'Only in the middle of the queue'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q055', 2, 'In an input-restricted deque:', ARRAY['Deletion is allowed at only one end, while insertion is allowed at both ends', 'Both insertion and deletion are allowed at only one end', 'Insertion is allowed at only one end, while deletion is allowed at both ends', 'Insertion is not allowed at any end'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q056', 2, 'A deque is initially empty. The operations insertFront(1), insertRear(2), insertFront(3), insertRear(4), deleteFront(), deleteRear() are performed in order. The contents of the deque from front to rear are:', ARRAY['3, 1', '2, 4', '1, 2, 4', '1, 2'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q057', 2, 'In the maze problem of the notes, the maze is represented by a two-dimensional array in which:', ARRAY['Ones represent open paths and zeros represent barriers', 'Zeros represent open paths and ones represent barriers', 'Zeros represent the exit and ones the entrance', 'Every position stores the number of its neighbours'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q058', 2, 'To avoid checking border conditions in the maze program, the maze is surrounded by a border of ones. An m x p maze therefore requires an array of size:', ARRAY['m x p', '(m + 1) x (p + 1)', '(m + 2) x (p + 2)', '(m + 2) x p'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q059', 2, 'A 6 x 8 maze is stored in an array with a border of ones. If the entrance is at maze[1][1], the exit is at:', ARRAY['maze[7][9]', 'maze[5][7]', 'maze[8][10]', 'maze[6][8]'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q060', 2, 'Since each position of an m x p maze is visited no more than once, the worst-case computing time of the maze-path algorithm is:', ARRAY['O(m + p)', 'O((mp)^2)', 'O(mp)', 'O(log mp)'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q061', 3, 'Each node of a singly linked list consists of:', ARRAY['A data field, a prev field and a next field', 'Only a data field', 'Two data fields and a counter', 'A data field and a next (link) field'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q062', 3, 'In a singly linked list, the next field of the last node contains:', ARRAY['The address of the first node', 'The address of the previous node', 'NULL', 'The value zero as data'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q063', 3, 'Which disadvantage of arrays is overcome by using linked lists?', ARRAY['Slow random access to the i-th element', 'Use of a common name for all the elements', 'Inability to store more than one data type', 'Fixed size, and costly insertion and deletion at a given position'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q064', 3, 'While traversing a singly linked list with a pointer current that starts at head, the traversal loop stops when:', ARRAY['current becomes NULL', 'current becomes equal to head again', 'current->data becomes zero', 'current->next points to head'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q065', 3, 'How many types of linked lists are listed in the notes?', ARRAY['2 (singly and doubly)', '4 (singly, doubly, circular singly and circular doubly)', '3 (singly, doubly and circular)', '5'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q066', 3, 'Each node of a doubly linked list consists of:', ARRAY['Data and a pointer to the next node', 'Data and a pointer to the previous node', 'Data, a pointer to the head and a pointer to the tail', 'Data, a pointer to the previous node and a pointer to the next node'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q067', 3, 'Which linked list supports traversal in both the forward and backward directions?', ARRAY['Singly linked list', 'Doubly linked list', 'Circular singly linked list', 'Singly linked list with a tail pointer'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q068', 3, 'In a circular linked list, the last node points to:', ARRAY['NULL', 'The previous node', 'The first node', 'Itself, in every list'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q069', 3, 'In a stack implemented using a singly linked list, push() inserts the new node at the:', ARRAY['End of the list', 'Beginning of the list (top)', 'Middle of the list', 'Position given by the data value'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q070', 3, 'Elements of a linked list are accessed:', ARRAY['Randomly using an index', 'Sequentially, starting from the head', 'Only from the tail', 'Using the memory address of the array base'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q071', 3, 'Which of the following correctly compares arrays and linked lists?', ARRAY['Array: non-contiguous memory and sequential access; Linked list: contiguous memory and random access', 'Both arrays and linked lists use contiguous memory and random access', 'Array: contiguous memory and random access; Linked list: non-contiguous memory and sequential access', 'Both arrays and linked lists use non-contiguous memory and sequential access'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q072', 3, 'In the memory representation of a linked list, the nodes and the pointer variable head declared inside main() are stored, respectively, in the:', ARRAY['Heap and stack', 'Stack and heap', 'Heap and heap', 'Stack and stack'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q073', 3, 'The time required to insert a new node at the end of a singly linked list when only the head pointer is available is:', ARRAY['O(1)', 'O(log n)', 'O(n^2)', 'O(n)'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q074', 3, 'The main advantage of implementing a stack with a linked list instead of an array is that:', ARRAY['Elements can be accessed randomly using an index', 'Memory is allocated contiguously', 'No pointer is needed for the top', 'The stack can grow and shrink dynamically without a fixed maximum capacity'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q075', 3, 'While inserting a new node at the beginning of a non-empty doubly linked list, which statement is required in addition to new_node->next = head?', ARRAY['head->next = new_node', 'new_node->prev = head', 'head->prev = new_node', 'head->prev = NULL'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q076', 3, 'When only a pointer to the node to be deleted is given, the time for deletion in a singly linked list and in a doubly linked list is, respectively:', ARRAY['O(n) and O(1)', 'O(1) and O(n)', 'O(1) and O(1)', 'O(n) and O(n)'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q077', 3, 'Which of the following is a disadvantage of a doubly linked list compared with a singly linked list?', ARRAY['It cannot be traversed in the backward direction', 'Insertion at the beginning requires traversing the whole list', 'Every node needs extra memory for the additional prev pointer', 'It cannot be used to implement a stack or a queue'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q078', 3, 'In a circular singly linked list represented by a pointer last to its last node, the first node is accessed as:', ARRAY['last->prev', 'last->next->next', 'last', 'last->next'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q079', 3, 'In a circular doubly linked list, the prev pointer of the first node stores the address of:', ARRAY['The last node', 'NULL', 'The second node', 'The first node itself'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q080', 3, 'Which of the following is a disadvantage of circular linked lists?', ARRAY['Traversal may enter an infinite loop unless a proper stopping condition is used', 'Insertion at the beginning is impossible', 'They cannot be used to implement a circular queue', 'The last node always contains NULL'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q081', 3, 'Assume the functions of the notes are available. What is the output of the following code? struct Node* head = NULL; head = insertAtBeginning(head, 10); head = insertAtBeginning(head, 20); head = insertAtBeginning(head, 30); head = insertAtEnd(head, 40); traverseLinkedList(head);', ARRAY['10 20 30 40', '40 30 20 10', '30 20 10 40', '30 20 40 10'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q082', 3, 'The singly linked list in the figure is modified by the code below. What does traverseLinkedList(head) print? head = removeLastNode(head); head = removeFirstNode(head); head = deleteAtPosition(head, 2); traverseLinkedList(head); head 12 25 7 40 NULL', ARRAY['25 7', '25', '7', '12'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q083', 3, 'A stack is implemented using a singly linked list as in the notes. Starting from an empty stack, the operations push(11), push(22), push(33), pop(), push(44), push(55), pop(), pop() are performed. What does peek() return?', ARRAY['11', '22', '33', '44'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q084', 3, 'Let tail point to the last node of the final list. What does backwardTraversal(tail) print after the following operations on a doubly linked list? struct Node* head = createNode(10); head = insertEnd(head, 20); head = insertEnd(head, 30); head = insertAtPosition(head, 3, 25);', ARRAY['10 20 25 30', '30 20 25 10', '30 25 10 20', '30 25 20 10'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q085', 3, 'A doubly linked list contains 1, 2, 3, 4, 5. The following statements are executed. If tail points to the last node of the resulting list, what does backwardTraversal(tail) print? head = delPos(head, 3); head = delLast(head); head = delHead(head);', ARRAY['4 2', '2 4', '5 4 2', '4 2 1'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q086', 3, 'What is the output of the following code on a circular singly linked list (insertion functions of the notes)? struct Node *last = NULL; last = insertAtBeginning(last, 10); last = insertEnd(last, 20); last = insertAtBeginning(last, 5); last = insertEnd(last, 30); printf("%d %d", last->data, last->next->data);', ARRAY['30 5', '30 10', '5 30', '20 5'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q087', 3, 'A circular singly linked list contains 5, 10, 20, 30 with last pointing to the node 30. After last = deleteFirstNode(last); last = deleteLastNode(last); what does printf("%d %d", last->data, last->next->data) print?', ARRAY['20 5', '30 10', '20 10', '10 20'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q088', 3, 'Inserting a new node between two existing nodes in the middle of a doubly linked list requires updating how many pointer fields in total?', ARRAY['2', '4', '3', '1'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q089', 3, 'A singly linked list contains the two nodes 7 -> 9 -> NULL. What is the state of the list after head = removeLastNode(head); (the function of the notes)?', ARRAY['An empty list', 'A single node 7 whose next is NULL', 'A single node 9 whose next is NULL', 'The list is unchanged because the loop never executes'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q090', 3, 'A singly linked list has 4 nodes. For which value of pos does insertPos(head, pos, data) of the notes print "Invalid position!"?', ARRAY['6', '5', '3', '1'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q091', 4, 'Which node of a tree has no parent?', ARRAY['Root node', 'Leaf node', 'Sibling node', 'Internal node'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q092', 4, 'A node with no children (a node of degree zero) is called a:', ARRAY['Root node', 'Internal node', 'Sibling node', 'Leaf (external or terminal) node'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q093', 4, 'A tree with N nodes has how many edges?', ARRAY['N - 1', 'N', 'N + 1', '2N - 1'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q094', 4, 'In the tree shown in the figure, what is the degree of node D? A B C D E F G H I J K L M', ARRAY['2', '4', '3', '1'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q095', 4, 'For the tree shown in the figure, using the convention of the notes (levels, heights and depths counted in edges, with the root at level 0), the depth of node M and the height of node B are, respectively: A B C D E F G H I J K L M', ARRAY['2 and 3', '4 and 2', '3 and 3', '3 and 2'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q096', 4, 'In the left child - right sibling representation of a tree, each node contains:', ARRAY['A data field, a reference to its left (first) child and a reference to its right sibling', 'A data field and references to all of its children', 'A data field, a parent reference and a degree field', 'A data field and a reference to the root'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q097', 4, 'A tree in which every node can have at most two children (a left child and a right child) is called a:', ARRAY['Threaded tree', 'General tree', 'Binary tree', 'Forest'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q098', 4, 'In a strictly binary tree (full binary tree), every node has:', ARRAY['Exactly one child', 'Either zero or two children', 'At most one child', 'Exactly two children, with all leaves at the same level'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q099', 4, 'In a binary tree whose root is on level 1, the maximum number of nodes on level i is:', ARRAY['2^i', '2^(i-1)', '2i - 1', 'i^2'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q100', 4, 'A non-empty binary tree has 7 leaf nodes. The number of nodes having two children is:', ARRAY['6', '7', '8', '3'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q101', 4, 'A strictly binary tree has 15 internal nodes (all of degree 2). The total number of nodes in the tree is:', ARRAY['31', '30', '32', '16'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q102', 4, 'A complete binary tree is stored in a one-dimensional array with the root at index 1. For the node at index 6, which statement is correct?', ARRAY['Parent at index 2, left child at index 12 and right child at index 13', 'Parent at index 3, left child at index 11 and right child at index 12', 'Parent at index 5, left child at index 7 and right child at index 8', 'Parent at index 3, left child at index 12 and right child at index 13'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q103', 4, 'A complete binary tree with 12 nodes is stored in an array with the root at index 1. Which statement is true?', ARRAY['Node 6 has no children', 'Node 6 has a left child (index 12) but no right child', 'Node 5 has no right child', 'The parent of node 12 is node 5'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q104', 4, 'The inorder traversal of a binary tree visits the nodes in the order:', ARRAY['Root, left subtree, right subtree', 'Left subtree, root, right subtree', 'Left subtree, right subtree, root', 'Right subtree, root, left subtree'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q105', 4, 'Which traversal visits the root node after both of its subtrees have been visited?', ARRAY['Preorder', 'Inorder', 'Postorder', 'Level-order'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q106', 4, 'What is the postorder traversal of the binary tree shown in the figure? A B C D F G H I J K', ARRAY['I J D F B K G H C A', 'A B D I J F C G K H', 'I D J B F A G K C H', 'I J D F B G K H C A'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q107', 4, 'The preorder traversal of a binary tree is A B D E C F and its inorder traversal is D B E A F C. Its postorder traversal is:', ARRAY['D B E F C A', 'D E B F C A', 'E D B F C A', 'D E B C F A'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q108', 4, 'An expression tree is built from the postfix expression A B / C * D * E +. Its level-order traversal is:', ARRAY['+ * * / A B C D E', '+ * E * D / C A B', 'A B / C * D * E +', '+ * E * D C / A B'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q109', 4, 'A binary tree has root 4 with a left child 2 and a right child 6 (both leaves). What is the output of the following function when called as trav(root)? void trav(tree_pointer p) { if (p) { printf("%d ", p->data); trav(p->left_child); trav(p->right_child); printf("%d ", p->data); } }', ARRAY['4 2 6 6 2 4', '4 2 6 4', '2 6 4 4 2 6', '4 2 2 6 6 4'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q110', 4, 'Level-order traversal of a binary tree is implemented using a:', ARRAY['Stack', 'Queue', 'Linked list sorted by key', 'Hash table'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q111', 4, 'In the iterative inorder traversal (iter_inorder) of an n-node binary tree, each node is placed on and removed from the stack:', ARRAY['Exactly once, giving O(n) time', 'Exactly twice, giving O(n^2) time', 'log n times, giving O(n log n) time', 'Only if it is a leaf, giving O(log n) time'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q112', 4, 'In a threaded binary tree node, if ptr->leftThread = TRUE, then ptr->leftChild contains:', ARRAY['A pointer to the left child', 'The address of the right sibling', 'A thread, not a pointer to the left child', 'Always NULL'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q113', 4, 'A header node is assumed for all threaded binary trees in order to:', ARRAY['Store the total number of nodes of the tree', 'Convert the tree into a complete binary tree', 'Make the tree a binary search tree', 'Avoid loose (dangling) threads; the original tree becomes the left subtree of the header node'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q114', 4, 'In a binary search tree, for every node:', ARRAY['Keys in its left subtree are larger and keys in its right subtree are smaller than its key', 'All keys in the tree are equal', 'Keys in its left subtree are smaller and keys in its right subtree are larger than its key', 'The left child is always a leaf'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q115', 4, 'If h is the height of a binary search tree, searching for a key (recursively or iteratively) takes:', ARRAY['O(1) time', 'O(h) time', 'O(h^2) time', 'O(n^2) time'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q116', 4, 'In a binary search tree, a new node is always inserted as a:', ARRAY['Root node', 'Internal node', 'Left child of the root', 'Leaf node'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q117', 4, 'The keys 10, 12, 5, 4, 20, 8, 7, 15, 13 are inserted, in this order, into an initially empty binary search tree. Taking the height of a tree with a single node as 0, the height of the resulting tree is:', ARRAY['3', '5', '4', '6'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q118', 4, 'The keys 10, 12, 5, 4, 20, 8, 7, 15, 13 are inserted, in this order, into an initially empty binary search tree. Its preorder traversal is:', ARRAY['10 5 4 8 7 12 20 15 13', '4 5 7 8 10 12 13 15 20', '10 5 12 4 8 20 7 15 13', '10 12 5 4 20 8 7 15 13'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q119', 4, 'To delete a node having two children from a binary search tree, the node is replaced by:', ARRAY['Its parent node', 'The smallest key in its left subtree or the largest key in its right subtree', 'Either the largest key in its left subtree or the smallest key in its right subtree', 'The root of the tree'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q120', 4, 'In the binary search tree built from the keys 10, 12, 5, 4, 20, 8, 7, 15, 13, the root 10 is deleted by replacing it with the largest key of its left subtree. Which key becomes the replacement?', ARRAY['7', '12', '5', '8'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q121', 5, 'The length of a path in a graph is:', ARRAY['The number of vertices in the path', 'The number of edges in the path', 'The sum of the degrees of its vertices', 'The number of cycles in the path'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q122', 5, 'A graph G = (V, E) consists of:', ARRAY['A set of edges only', 'A set of vertices only, with no relation between them', 'A finite non-empty set of vertices V and a set E of pairs of vertices called edges', 'A set of nodes arranged in levels'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q123', 5, 'In an undirected graph, the pairs (u, v) and (v, u):', ARRAY['Represent two different edges', 'Represent the same edge', 'Represent a self loop', 'Cannot both be present in the graph'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q124', 5, 'How many edges does a complete undirected graph with 6 vertices have?', ARRAY['30', '12', '21', '15'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q125', 5, 'An edge of the form (v, v), which starts and ends at the same vertex, is called a:', ARRAY['Multi-edge', 'Cycle of length two', 'Weighted edge', 'Self loop (self edge)'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q126', 5, 'For the directed graph shown in the figure, the in-degree and the out-degree of vertex c are, respectively: a b d c', ARRAY['1 and 2', '2 and 1', '2 and 2', '3 and 1'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q127', 5, 'A directed graph G is said to be strongly connected if:', ARRAY['For every pair of distinct vertices u and v there is a directed path from u to v and from v to u', 'It contains no cycles', 'Every vertex has at least one outgoing edge', 'Every vertex has in-degree equal to its out-degree'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q128', 5, 'The adjacency matrix of an undirected graph is always:', ARRAY['Symmetric', 'Upper triangular', 'A diagonal matrix', 'An identity matrix'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q129', 5, 'For an undirected graph with n vertices and e edges, the adjacency list representation requires an array of size n and how many chain nodes?', ARRAY['e', 'n + e', 'n^2', '2e'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q130', 5, 'In the adjacency multilist representation of a graph:', ARRAY['Each edge is represented by two nodes, one in each end vertex''s list', 'Each vertex is represented by n nodes', 'Only the edge weights are stored, not the vertices', 'Each edge is represented by exactly one node, which appears in the lists of both of its end vertices'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q131', 5, 'Which data structure is used to maintain the current position in the adjacency lists during depth first search?', ARRAY['Queue', 'Priority queue', 'Stack', 'Hash table'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q132', 5, 'Breadth first search of a graph uses which data structure to hold the visited vertices whose adjacency lists are yet to be examined?', ARRAY['Stack', 'Queue', 'Binary tree', 'Array of weights'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q133', 5, 'For a graph with n vertices and e edges, the time taken by depth first search when the graph is represented by an adjacency list and by an adjacency matrix is, respectively:', ARRAY['O(e) and O(n^2)', 'O(n^2) and O(e)', 'O(n) and O(n)', 'O(e) and O(e)'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q134', 5, 'A depth first search is started from vertex 0 of the undirected graph in the figure. The adjacency lists are 0: 1, 2; 1: 0, 3, 4; 2: 0, 4; 3: 1; 4: 1, 2, and the vertices of each list are examined in the given order. The vertices are visited in the order: 0 1 2 3 4', ARRAY['0 1 3 4 2', '0 1 2 3 4', '0 2 4 1 3', '0 1 4 2 3'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q135', 5, 'A directed graph has the adjacency lists 0: 2, 1, 3; 1: 4; 2: 5, 4; 3: 5; 4: 6; 5: 6; 6: (none). A breadth first search is started from vertex 0 and the adjacency lists are scanned in the given order. The vertices are visited in the order:', ARRAY['0 1 2 3 4 5 6', '0 2 1 3 5 4 6', '0 2 5 6 4 1 3', '0 2 1 3 4 5 6'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q136', 5, 'Insertion sort (as given in the notes) is applied to the list 5, 2, 4, 6, 1, 3. The total number of times an element is shifted one position to the right (a[i+1] = a[i]) during the sort is:', ARRAY['9', '10', '8', '15'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q137', 5, 'Radix sort (least significant digit first, with each bucket preserving the input order) is applied to 348, 143, 361, 423, 538, 128, 321, 543, 366. The list after the first pass (units digit) is:', ARRAY['321 361 143 423 543 366 538 348 128', '128 143 321 348 361 366 423 538 543', '361 321 143 423 543 366 348 538 128', '348 143 361 423 538 128 321 543 366'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q138', 5, 'If each number in a list has s digits (radix d), the radix sort algorithm requires:', ARRAY['d passes', 's passes', 'n passes', 'log n passes'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q139', 5, 'The function f used in address calculation sort must be order preserving, which means:', ARRAY['If x <= y then f(x) <= f(y)', 'If x <= y then f(x) >= f(y)', 'f(x) is different for every key x', 'f(x) is chosen randomly for every key'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q140', 5, 'In hashing, a collision occurs when:', ARRAY['A key is not found in the hash table', 'The hash table becomes empty', 'Two or more keys map to the same memory location', 'The hash function returns a negative value'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q141', 5, 'In the division method of hashing, the hash function is:', ARRAY['h(x) = x div M', 'h(x) = x * M', 'h(x) = M - x', 'h(x) = x mod M'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q142', 5, 'A hash table of size 10 uses H(k) = k mod 10 with linear probing. The keys 72, 27, 36, 24, 63, 81, 92, 101 are inserted in this order. At which index is the key 101 stored?', ARRAY['5', '8', '1', '9'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q143', 5, 'The keys 72, 27, 36, 24, 63, 81, 92, 101 are stored, in this order, in a hash table of size 10 using H(k) = k mod 10 and linear probing. The average search length (total probes needed to find all 8 keys divided by 8) is:', ARRAY['2.0', '1.5', '2.25', '3.0'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q144', 5, 'A hash table of size 10 uses H(k) = k mod 10 with quadratic probing (probes h, h+1, h+4, h+9, ...). The keys 22, 32 and 42 are inserted in this order. At which index is 42 stored?', ARRAY['4', '3', '5', '6'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q145', 5, 'Double hashing with H1(key) = key % 10 and H2(key) = 7 - (key % 7) is used, and a collision is resolved with (H1(key) + i x H2(key)) % 10. The keys 37, 90, 45, 22, 17, 49, 55 are inserted in this order. At which index is the key 17 stored?', ARRAY['1', '8', '4', '7'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q146', 5, 'Using the folding method for a hash table with 100 locations, the key 123456 is divided into the parts 12, 34 and 56, which are added, ignoring any carry. The hash value is:', ARRAY['102', '12', '56', '2 (that is, 02)'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q147', 5, 'Words are stored using chaining in a table of size 5 with H(str) = (sum of the positions of its letters in the English alphabet) % 5. The words like, a, tree, you, first, a, place, to are inserted in this order at the rear of their chains. The words in the chain of index 2 are:', ARRAY['a, you, a', 'tree, first, place', 'like, first, place', 'like, tree, place'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q148', 5, 'In rehashing, when the hash table becomes nearly full:', ARRAY['The entries are copied to the same positions of a bigger table', 'A new table of double the size is created and every entry is re-inserted using its newly computed hash value', 'The size of the table is halved and the entries are rehashed', 'All the chains are deleted and the table is emptied'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q149', 5, 'Which of the following is a drawback of static hashing?', ARRAY['The table size is fixed, so it cannot accommodate data growth and collisions increase as the data grows', 'It requires a directory of pointers that must be doubled', 'It cannot use chaining or linear probing', 'The hash function cannot be computed in constant time'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q150', 5, 'Which statement about dynamic hashing is correct?', ARRAY['Linear hashing uses a directory that is doubled, whereas extendible hashing splits buckets in round-robin order', 'Both extendible and linear hashing use a table of fixed size', 'Extendible hashing uses a directory that is doubled, splitting only the bucket that overflowed, whereas linear hashing uses no directory and splits buckets in round-robin order', 'Extendible hashing needs overflow pages, whereas linear hashing needs none'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


END $$;


DO $$
DECLARE
    v_sub_id bigint;
    v_bank_id bigint;
    v_creator_id bigint;
BEGIN
    SELECT id INTO v_sub_id FROM subject WHERE code = '21CS32' LIMIT 1;
    SELECT id INTO v_creator_id FROM account WHERE username = 'hod.cse' LIMIT 1;
    IF v_creator_id IS NULL THEN
        SELECT id INTO v_creator_id FROM account WHERE role = 'HOD' LIMIT 1;
    END IF;
    IF v_creator_id IS NULL THEN
        v_creator_id := 1;
    END IF;

    -- Ensure question_bank header
    SELECT id INTO v_bank_id FROM question_bank 
    WHERE subject_id = v_sub_id AND department_id = 2 AND semester = 3 LIMIT 1;

    IF v_bank_id IS NULL THEN
        INSERT INTO question_bank (department_id, subject_id, academic_session, semester, title, created_by, state, total_questions)
        VALUES (2, v_sub_id, '2025-26', 3, 'Data Structures & Algorithms Question Bank (150 MCQs)', v_creator_id, 'FINALIZED', 150)
        RETURNING id INTO v_bank_id;
    ELSE
        UPDATE question_bank SET total_questions = 150, state = 'FINALIZED' WHERE id = v_bank_id;
    END IF;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q001', 1, 'According to the notes, a data structure can be expressed as:', ARRAY['Data Structure = Organized data + Allowed operations', 'Data Structure = Algorithm + Flowchart', 'Data Structure = Program + Compiler', 'Data Structure = Input + Output'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q002', 1, 'A field K whose values uniquely determine a record in a file is called a:', ARRAY['Primary key', 'Group item', 'Entity set', 'Variable-length record'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q003', 1, 'Which of the following is a primitive data structure?', ARRAY['Array', 'Integer', 'Tree', 'Graph'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q004', 1, 'Which of the following is a non-linear data structure?', ARRAY['Stack', 'Queue', 'Linked list', 'Tree'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q005', 1, 'In data structure operations, merging means:', ARRAY['Arranging all data items in ascending or descending order', 'Combining the data items of two sorted lists into a single list', 'Finding whether a desired data item is present in a list', 'Reserving memory for the program elements'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q006', 1, 'A pointer is:', ARRAY['A variable that can store only integer constants', 'A special variable that contains the address of a memory location', 'A function that allocates memory at run time', 'A data type that stores a sequence of characters'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q007', 1, 'A pointer that has not been initialized with a valid address is known as a:', ARRAY['NULL pointer', 'Void pointer', 'Dangling (wild) pointer', 'Pointer to pointer'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q008', 1, 'Memory requested at run time using malloc() and calloc() is allocated from the:', ARRAY['Stack', 'Static (compile-time) data area', 'CPU registers', 'Heap'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q009', 1, 'Which dynamic memory allocation function initializes every allocated block to zero?', ARRAY['malloc()', 'realloc()', 'calloc()', 'free()'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q010', 1, 'Which statement correctly distinguishes calloc() from malloc()?', ARRAY['calloc() takes one argument and leaves the allocated memory uninitialized', 'calloc() takes two arguments (number of elements, element size) and initializes the memory to zero', 'calloc() releases previously allocated memory, while malloc() allocates it', 'calloc() allocates memory at compile time, while malloc() does it at run time'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q011', 1, 'If realloc() cannot extend an existing memory block in place, it:', ARRAY['Leaves the old block unchanged and returns a pointer to its first byte', 'Frees the old block and returns an uninitialized block without copying any data', 'Allocates a new block, copies the old contents into it and frees the old block', 'Always terminates the program with a run-time error'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q012', 1, 'What is the output of the following code? int a[5] = {10, 20, 30, 40, 50}; int *p = a; printf("%d %d", *(p + 2), 3[a]);', ARRAY['20 40', '30 30', 'Compilation error', '30 40'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q013', 1, 'Which declaration creates an array of 5 pointers to integers?', ARRAY['int *a;', 'int a[5];', 'int *a[5];', 'int **a;'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q014', 1, 'Binary search is applied on the sorted array {2, 5, 8, 12, 16, 23, 38, 56, 72, 91} with low = 0, high = 9 and mid = (low + high)/2 to find the key 23. How many times is mid computed before the key is found?', ARRAY['3', '2', '4', '5'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q015', 1, 'What is the output of the following code that inserts an item into an array? int a[10] = {5, 10, 15, 20}, n = 4, pos = 2, item = 12, i; for (i = n - 1; i >= pos; i--) a[i + 1] = a[i]; a[pos] = item; n = n + 1; for (i = 0; i < n; i++) printf("%d ", a[i]);', ARRAY['5 10 15 12 20', '5 10 12 15 20', '12 5 10 15 20', '5 10 12 20 20'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q016', 1, 'What is the output of the following code? int m[2][3] = { {1, 4, 2}, {3, 6, 8} }; int i, j, s = 0; for (i = 0; i < 2; i++) for (j = 0; j < 3; j++) if (i != j) s += m[i][j]; printf("%d", s);', ARRAY['24', '7', '21', '17'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q017', 1, 'To create a 2-D integer array of rows x cols dynamically using the pointer-to-pointer method of the notes, how many MALLOC (malloc) calls are needed in total?', ARRAY['1', 'rows x cols', 'rows + 1', 'cols + 1'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q018', 1, 'What is the output of the following code? int a = 10; int *p1 = &a; int **p2 = &p1; **p2 = **p2 + 5; printf("%d %d", a, *p1);', ARRAY['10 15', '15 10', '10 10', '15 15'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q019', 1, 'Which of the following structure definitions results in a syntax error?', ARRAY['struct str1 { int i; char c; } var1 = {10, ''A''};', 'struct str1 { int i = 10; char c = ''A''; };', 'struct str1 { int i; char c; }; struct str1 var1 = {10, ''A''};', 'struct str1 { int i; char c; float f; } s1, s2;'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q020', 1, 'Which of the following is a self-referential structure?', ARRAY['struct node { int data; struct node next; };', 'struct node { int data; int *next; };', 'struct node { int data; };', 'struct node { int data; struct node *next; };'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q021', 1, 'The size of a union is equal to the size of its:', ARRAY['Largest member', 'Smallest member', 'Sum of all members', 'First member'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q022', 1, 'Which statement about structures and unions is correct?', ARRAY['Altering one member of a structure alters the other members, but not in a union', 'In a structure each member has its own storage, whereas all members of a union share the same memory', 'A union allocates memory equal to the sum of the sizes of its members', 'All members of a union can be initialized at once, but only the first member of a structure can be'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q023', 1, 'Using the addpolynomial() logic of the notes (terms are stored in decreasing order of exponent and a term is attached only when its coefficient is non-zero), the sum of A(x) = 5x^3 + 4x^2 + 2 and B(x) = 3x^3 - 4x^2 + 7x is:', ARRAY['8x^3 + 0x^2 + 7x + 2', '8x^3 + 8x^2 + 7x + 2', '2x^3 + 8x^2 + 7x + 2', '8x^3 + 7x + 2'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q024', 1, 'A sparse matrix is a matrix that has:', ARRAY['A greater number of zero elements than non-zero elements', 'Only non-zero elements', 'More rows than columns', 'Non-zero elements only on its diagonal'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q025', 1, 'In the (row, column, value) triple representation of a sparse matrix, the first entry A[0] stores:', ARRAY['The first non-zero element of the matrix', 'The number of zero elements, rows and columns', 'The number of rows, the number of columns and the number of non-zero terms', 'The largest element and its row and column'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q026', 1, 'The 4 x 4 sparse matrix A shown below is stored as triples with B[0] = (4, 4, 5) for its transpose. Using the column-by-column transpose algorithm of the notes, what is B[4]? | 0  0  3  0 | A = | 0  0  0  8 | | 1  0  3  0 | | 0  0  7  0 |', ARRAY['(3, 1, 8)', '(2, 3, 7)', '(2, 2, 3)', '(0, 2, 1)'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q027', 1, 'For a sparse matrix with c columns and t non-zero terms, the transpose function of the notes (which scans all t terms once for every column) runs in time:', ARRAY['O(c x t)', 'O(c + t)', 'O(t)', 'O(c)'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q028', 1, 'A string in C is a sequence of characters terminated by the:', ARRAY['Null character ''\0''', 'Newline character ''\n''', 'Space character', 'Tab character ''\t'''], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q029', 1, 'What is the output of the following code? #include <string.h> char s[] = "Hello"; printf("%d", (int)(sizeof(s) + strlen(s)));', ARRAY['10', '12', '11', '5'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M1-Q030', 1, 'What is the output of the following code? char a[20] = "Data"; char b[] = "Struct"; strcat(a, b); printf("%s %d", a, (int)strlen(a));', ARRAY['DataStruct 10', 'DataStruct 11', 'StructData 10', 'Data 4'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q031', 2, 'In a stack, insertions (push) and deletions (pop) are made at one end called the:', ARRAY['Top', 'Front', 'Rear', 'Base'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q032', 2, 'Trying to push an element onto a stack that is already full is called:', ARRAY['Overflow', 'Underflow', 'Deadlock', 'Wrap-around'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q033', 2, 'Which auxiliary stack operation returns the last inserted element without removing it?', ARRAY['Pop()', 'Push()', 'Top()', 'Size()'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q034', 2, 'When a stack is implemented using an array, the value of top for an empty stack is initialized to:', ARRAY['-1', '0', '1', 'MAX_STACK_SIZE'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q035', 2, 'When a function is invoked, its stack frame placed on the system stack initially contains:', ARRAY['Only the local variables of the invoking function', 'The source code of the invoked function', 'A pointer to the previous stack frame and the return address', 'The final return value and an overflow flag'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q036', 2, 'For an array-based stack of size MAX_STACK_SIZE, the stack is full when:', ARRAY['top < 0', 'top >= MAX_STACK_SIZE - 1', 'top == MAX_STACK_SIZE', 'top == 0'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q037', 2, 'In the array-doubling strategy for a stack stored in a dynamic array, the total time spent on all array doublings over n push operations is:', ARRAY['O(n^2)', 'O(log n)', 'O(n)', 'O(n log n)'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q038', 2, 'In the infix-to-postfix algorithm using in-stack precedence (isp) and incoming precedence (icp), the left parenthesis has:', ARRAY['High in-stack precedence and low incoming precedence', 'Low in-stack precedence (isp = 0) but high incoming precedence (icp = 20)', 'Equal in-stack and incoming precedence of 0', 'Equal in-stack and incoming precedence of 20'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q039', 2, 'In which notation does the operator appear after its operands, as in A B +?', ARRAY['Postfix (reverse Polish) notation', 'Prefix (Polish) notation', 'Infix notation', 'Parenthesized infix notation'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q040', 2, 'The postfix form of the infix expression a*(b+c)*d is:', ARRAY['ab*c+d*', 'abcd+**', 'abc+*d*', 'abc*+d*'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q041', 2, 'The postfix form of the infix expression a+b*c-d/e is:', ARRAY['ab+c*de/-', 'abc*de/+-', 'abcde*/+-', 'abc*+de/-'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q042', 2, 'What is the value of the postfix expression 5 6 2 + * 12 4 / -?', ARRAY['37', '-37', '43', '3'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q043', 2, 'The prefix form of the infix expression (A + B) * C is:', ARRAY['+ A * B C', 'A B + C *', '* A + B C', '* + A B C'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q044', 2, 'Starting with an empty stack, the operations push(3), push(6), push(9), pop(), push(12), pop(), pop() are performed. What are the values returned by Top() and Size() now?', ARRAY['Top = 6, Size = 2', 'Top = 3, Size = 1', 'Top = 12, Size = 2', 'Top = 9, Size = 1'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q045', 2, 'What is the output of the following code? int stack[10], top = -1, x, y; stack[++top] = 4; stack[++top] = 7; stack[++top] = 2; x = stack[top--]; y = stack[top--]; stack[++top] = x * y; printf("%d %d", stack[top], top);', ARRAY['28 1', '14 1', '14 2', '14 0'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q046', 2, 'A stack uses a dynamically allocated array with an initial capacity of 1 and doubles the capacity (using realloc) whenever a push arrives while the array is full. What is the capacity after 9 pushes?', ARRAY['16', '9', '8', '18'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q047', 2, 'A queue works on which of the following principles?', ARRAY['Last-In-First-Out (LIFO)', 'Highest-priority-last', 'Random access', 'First-In-First-Out (FIFO)'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q048', 2, 'In the array implementation of a linear queue (with f initialized to 0 and r to -1), the queue is empty when:', ARRAY['f < r', 'f > r', 'r == QUEUESIZE - 1', 'f == QUEUESIZE - 1'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q049', 2, 'The figure shows a linear queue stored in an array with QUEUESIZE = 5, f = 2 and r = 4. What happens when insertQ(60, &r, q) is executed? q[ ] 0 1 30 2 40 3 50 4 f r', ARRAY['60 is stored at index 0', '60 is stored at index 5', 'It prints "Queue Empty"', 'It prints "queue overflow" even though locations 0 and 1 are empty'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q050', 2, 'In a circular queue implemented with an array of size QUEUESIZE, the rear is advanced during insertion using:', ARRAY['rear = rear + 1', 'rear = (rear - 1) % QUEUESIZE', 'rear = rear % QUEUESIZE + 1', 'rear = (rear + 1) % QUEUESIZE'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q051', 2, 'A circular queue (QUEUESIZE = 5) uses the variables f, r and count, initially f = 0, r = -1, count = 0. The operations performed are: insert 10, 20, 30, 40; delete twice; insert 50, 60, 70. The final values of f, r and count are:', ARRAY['f = 2, r = 1, count = 5', 'f = 2, r = 2, count = 5', 'f = 0, r = 1, count = 5', 'f = 2, r = 1, count = 3'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q052', 2, 'Elements 9, 4 and 6 are inserted, in this order, into an ascending priority queue. The order in which they are deleted is:', ARRAY['4, 6, 9', '9, 4, 6', '6, 4, 9', '9, 6, 4'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q053', 2, 'A priority queue is mainly used to implement:', ARRAY['Recursion', 'CPU scheduling algorithms', 'Binary search', 'Matrix multiplication'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q054', 2, 'In a deque (double-ended queue), insertion and deletion can be performed:', ARRAY['Only at the front end', 'At both the front and the rear ends', 'Only at the rear end', 'Only in the middle of the queue'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q055', 2, 'In an input-restricted deque:', ARRAY['Deletion is allowed at only one end, while insertion is allowed at both ends', 'Both insertion and deletion are allowed at only one end', 'Insertion is allowed at only one end, while deletion is allowed at both ends', 'Insertion is not allowed at any end'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q056', 2, 'A deque is initially empty. The operations insertFront(1), insertRear(2), insertFront(3), insertRear(4), deleteFront(), deleteRear() are performed in order. The contents of the deque from front to rear are:', ARRAY['3, 1', '2, 4', '1, 2, 4', '1, 2'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q057', 2, 'In the maze problem of the notes, the maze is represented by a two-dimensional array in which:', ARRAY['Ones represent open paths and zeros represent barriers', 'Zeros represent open paths and ones represent barriers', 'Zeros represent the exit and ones the entrance', 'Every position stores the number of its neighbours'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q058', 2, 'To avoid checking border conditions in the maze program, the maze is surrounded by a border of ones. An m x p maze therefore requires an array of size:', ARRAY['m x p', '(m + 1) x (p + 1)', '(m + 2) x (p + 2)', '(m + 2) x p'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q059', 2, 'A 6 x 8 maze is stored in an array with a border of ones. If the entrance is at maze[1][1], the exit is at:', ARRAY['maze[7][9]', 'maze[5][7]', 'maze[8][10]', 'maze[6][8]'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M2-Q060', 2, 'Since each position of an m x p maze is visited no more than once, the worst-case computing time of the maze-path algorithm is:', ARRAY['O(m + p)', 'O((mp)^2)', 'O(mp)', 'O(log mp)'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q061', 3, 'Each node of a singly linked list consists of:', ARRAY['A data field, a prev field and a next field', 'Only a data field', 'Two data fields and a counter', 'A data field and a next (link) field'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q062', 3, 'In a singly linked list, the next field of the last node contains:', ARRAY['The address of the first node', 'The address of the previous node', 'NULL', 'The value zero as data'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q063', 3, 'Which disadvantage of arrays is overcome by using linked lists?', ARRAY['Slow random access to the i-th element', 'Use of a common name for all the elements', 'Inability to store more than one data type', 'Fixed size, and costly insertion and deletion at a given position'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q064', 3, 'While traversing a singly linked list with a pointer current that starts at head, the traversal loop stops when:', ARRAY['current becomes NULL', 'current becomes equal to head again', 'current->data becomes zero', 'current->next points to head'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q065', 3, 'How many types of linked lists are listed in the notes?', ARRAY['2 (singly and doubly)', '4 (singly, doubly, circular singly and circular doubly)', '3 (singly, doubly and circular)', '5'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q066', 3, 'Each node of a doubly linked list consists of:', ARRAY['Data and a pointer to the next node', 'Data and a pointer to the previous node', 'Data, a pointer to the head and a pointer to the tail', 'Data, a pointer to the previous node and a pointer to the next node'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q067', 3, 'Which linked list supports traversal in both the forward and backward directions?', ARRAY['Singly linked list', 'Doubly linked list', 'Circular singly linked list', 'Singly linked list with a tail pointer'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q068', 3, 'In a circular linked list, the last node points to:', ARRAY['NULL', 'The previous node', 'The first node', 'Itself, in every list'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q069', 3, 'In a stack implemented using a singly linked list, push() inserts the new node at the:', ARRAY['End of the list', 'Beginning of the list (top)', 'Middle of the list', 'Position given by the data value'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q070', 3, 'Elements of a linked list are accessed:', ARRAY['Randomly using an index', 'Sequentially, starting from the head', 'Only from the tail', 'Using the memory address of the array base'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q071', 3, 'Which of the following correctly compares arrays and linked lists?', ARRAY['Array: non-contiguous memory and sequential access; Linked list: contiguous memory and random access', 'Both arrays and linked lists use contiguous memory and random access', 'Array: contiguous memory and random access; Linked list: non-contiguous memory and sequential access', 'Both arrays and linked lists use non-contiguous memory and sequential access'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q072', 3, 'In the memory representation of a linked list, the nodes and the pointer variable head declared inside main() are stored, respectively, in the:', ARRAY['Heap and stack', 'Stack and heap', 'Heap and heap', 'Stack and stack'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q073', 3, 'The time required to insert a new node at the end of a singly linked list when only the head pointer is available is:', ARRAY['O(1)', 'O(log n)', 'O(n^2)', 'O(n)'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q074', 3, 'The main advantage of implementing a stack with a linked list instead of an array is that:', ARRAY['Elements can be accessed randomly using an index', 'Memory is allocated contiguously', 'No pointer is needed for the top', 'The stack can grow and shrink dynamically without a fixed maximum capacity'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q075', 3, 'While inserting a new node at the beginning of a non-empty doubly linked list, which statement is required in addition to new_node->next = head?', ARRAY['head->next = new_node', 'new_node->prev = head', 'head->prev = new_node', 'head->prev = NULL'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q076', 3, 'When only a pointer to the node to be deleted is given, the time for deletion in a singly linked list and in a doubly linked list is, respectively:', ARRAY['O(n) and O(1)', 'O(1) and O(n)', 'O(1) and O(1)', 'O(n) and O(n)'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q077', 3, 'Which of the following is a disadvantage of a doubly linked list compared with a singly linked list?', ARRAY['It cannot be traversed in the backward direction', 'Insertion at the beginning requires traversing the whole list', 'Every node needs extra memory for the additional prev pointer', 'It cannot be used to implement a stack or a queue'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q078', 3, 'In a circular singly linked list represented by a pointer last to its last node, the first node is accessed as:', ARRAY['last->prev', 'last->next->next', 'last', 'last->next'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q079', 3, 'In a circular doubly linked list, the prev pointer of the first node stores the address of:', ARRAY['The last node', 'NULL', 'The second node', 'The first node itself'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q080', 3, 'Which of the following is a disadvantage of circular linked lists?', ARRAY['Traversal may enter an infinite loop unless a proper stopping condition is used', 'Insertion at the beginning is impossible', 'They cannot be used to implement a circular queue', 'The last node always contains NULL'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q081', 3, 'Assume the functions of the notes are available. What is the output of the following code? struct Node* head = NULL; head = insertAtBeginning(head, 10); head = insertAtBeginning(head, 20); head = insertAtBeginning(head, 30); head = insertAtEnd(head, 40); traverseLinkedList(head);', ARRAY['10 20 30 40', '40 30 20 10', '30 20 10 40', '30 20 40 10'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q082', 3, 'The singly linked list in the figure is modified by the code below. What does traverseLinkedList(head) print? head = removeLastNode(head); head = removeFirstNode(head); head = deleteAtPosition(head, 2); traverseLinkedList(head); head 12 25 7 40 NULL', ARRAY['25 7', '25', '7', '12'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q083', 3, 'A stack is implemented using a singly linked list as in the notes. Starting from an empty stack, the operations push(11), push(22), push(33), pop(), push(44), push(55), pop(), pop() are performed. What does peek() return?', ARRAY['11', '22', '33', '44'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q084', 3, 'Let tail point to the last node of the final list. What does backwardTraversal(tail) print after the following operations on a doubly linked list? struct Node* head = createNode(10); head = insertEnd(head, 20); head = insertEnd(head, 30); head = insertAtPosition(head, 3, 25);', ARRAY['10 20 25 30', '30 20 25 10', '30 25 10 20', '30 25 20 10'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q085', 3, 'A doubly linked list contains 1, 2, 3, 4, 5. The following statements are executed. If tail points to the last node of the resulting list, what does backwardTraversal(tail) print? head = delPos(head, 3); head = delLast(head); head = delHead(head);', ARRAY['4 2', '2 4', '5 4 2', '4 2 1'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q086', 3, 'What is the output of the following code on a circular singly linked list (insertion functions of the notes)? struct Node *last = NULL; last = insertAtBeginning(last, 10); last = insertEnd(last, 20); last = insertAtBeginning(last, 5); last = insertEnd(last, 30); printf("%d %d", last->data, last->next->data);', ARRAY['30 5', '30 10', '5 30', '20 5'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q087', 3, 'A circular singly linked list contains 5, 10, 20, 30 with last pointing to the node 30. After last = deleteFirstNode(last); last = deleteLastNode(last); what does printf("%d %d", last->data, last->next->data) print?', ARRAY['20 5', '30 10', '20 10', '10 20'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q088', 3, 'Inserting a new node between two existing nodes in the middle of a doubly linked list requires updating how many pointer fields in total?', ARRAY['2', '4', '3', '1'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q089', 3, 'A singly linked list contains the two nodes 7 -> 9 -> NULL. What is the state of the list after head = removeLastNode(head); (the function of the notes)?', ARRAY['An empty list', 'A single node 7 whose next is NULL', 'A single node 9 whose next is NULL', 'The list is unchanged because the loop never executes'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M3-Q090', 3, 'A singly linked list has 4 nodes. For which value of pos does insertPos(head, pos, data) of the notes print "Invalid position!"?', ARRAY['6', '5', '3', '1'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q091', 4, 'Which node of a tree has no parent?', ARRAY['Root node', 'Leaf node', 'Sibling node', 'Internal node'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q092', 4, 'A node with no children (a node of degree zero) is called a:', ARRAY['Root node', 'Internal node', 'Sibling node', 'Leaf (external or terminal) node'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q093', 4, 'A tree with N nodes has how many edges?', ARRAY['N - 1', 'N', 'N + 1', '2N - 1'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q094', 4, 'In the tree shown in the figure, what is the degree of node D? A B C D E F G H I J K L M', ARRAY['2', '4', '3', '1'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q095', 4, 'For the tree shown in the figure, using the convention of the notes (levels, heights and depths counted in edges, with the root at level 0), the depth of node M and the height of node B are, respectively: A B C D E F G H I J K L M', ARRAY['2 and 3', '4 and 2', '3 and 3', '3 and 2'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q096', 4, 'In the left child - right sibling representation of a tree, each node contains:', ARRAY['A data field, a reference to its left (first) child and a reference to its right sibling', 'A data field and references to all of its children', 'A data field, a parent reference and a degree field', 'A data field and a reference to the root'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q097', 4, 'A tree in which every node can have at most two children (a left child and a right child) is called a:', ARRAY['Threaded tree', 'General tree', 'Binary tree', 'Forest'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q098', 4, 'In a strictly binary tree (full binary tree), every node has:', ARRAY['Exactly one child', 'Either zero or two children', 'At most one child', 'Exactly two children, with all leaves at the same level'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q099', 4, 'In a binary tree whose root is on level 1, the maximum number of nodes on level i is:', ARRAY['2^i', '2^(i-1)', '2i - 1', 'i^2'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q100', 4, 'A non-empty binary tree has 7 leaf nodes. The number of nodes having two children is:', ARRAY['6', '7', '8', '3'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q101', 4, 'A strictly binary tree has 15 internal nodes (all of degree 2). The total number of nodes in the tree is:', ARRAY['31', '30', '32', '16'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q102', 4, 'A complete binary tree is stored in a one-dimensional array with the root at index 1. For the node at index 6, which statement is correct?', ARRAY['Parent at index 2, left child at index 12 and right child at index 13', 'Parent at index 3, left child at index 11 and right child at index 12', 'Parent at index 5, left child at index 7 and right child at index 8', 'Parent at index 3, left child at index 12 and right child at index 13'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q103', 4, 'A complete binary tree with 12 nodes is stored in an array with the root at index 1. Which statement is true?', ARRAY['Node 6 has no children', 'Node 6 has a left child (index 12) but no right child', 'Node 5 has no right child', 'The parent of node 12 is node 5'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q104', 4, 'The inorder traversal of a binary tree visits the nodes in the order:', ARRAY['Root, left subtree, right subtree', 'Left subtree, root, right subtree', 'Left subtree, right subtree, root', 'Right subtree, root, left subtree'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q105', 4, 'Which traversal visits the root node after both of its subtrees have been visited?', ARRAY['Preorder', 'Inorder', 'Postorder', 'Level-order'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q106', 4, 'What is the postorder traversal of the binary tree shown in the figure? A B C D F G H I J K', ARRAY['I J D F B K G H C A', 'A B D I J F C G K H', 'I D J B F A G K C H', 'I J D F B G K H C A'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q107', 4, 'The preorder traversal of a binary tree is A B D E C F and its inorder traversal is D B E A F C. Its postorder traversal is:', ARRAY['D B E F C A', 'D E B F C A', 'E D B F C A', 'D E B C F A'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q108', 4, 'An expression tree is built from the postfix expression A B / C * D * E +. Its level-order traversal is:', ARRAY['+ * * / A B C D E', '+ * E * D / C A B', 'A B / C * D * E +', '+ * E * D C / A B'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q109', 4, 'A binary tree has root 4 with a left child 2 and a right child 6 (both leaves). What is the output of the following function when called as trav(root)? void trav(tree_pointer p) { if (p) { printf("%d ", p->data); trav(p->left_child); trav(p->right_child); printf("%d ", p->data); } }', ARRAY['4 2 6 6 2 4', '4 2 6 4', '2 6 4 4 2 6', '4 2 2 6 6 4'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q110', 4, 'Level-order traversal of a binary tree is implemented using a:', ARRAY['Stack', 'Queue', 'Linked list sorted by key', 'Hash table'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q111', 4, 'In the iterative inorder traversal (iter_inorder) of an n-node binary tree, each node is placed on and removed from the stack:', ARRAY['Exactly once, giving O(n) time', 'Exactly twice, giving O(n^2) time', 'log n times, giving O(n log n) time', 'Only if it is a leaf, giving O(log n) time'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q112', 4, 'In a threaded binary tree node, if ptr->leftThread = TRUE, then ptr->leftChild contains:', ARRAY['A pointer to the left child', 'The address of the right sibling', 'A thread, not a pointer to the left child', 'Always NULL'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q113', 4, 'A header node is assumed for all threaded binary trees in order to:', ARRAY['Store the total number of nodes of the tree', 'Convert the tree into a complete binary tree', 'Make the tree a binary search tree', 'Avoid loose (dangling) threads; the original tree becomes the left subtree of the header node'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q114', 4, 'In a binary search tree, for every node:', ARRAY['Keys in its left subtree are larger and keys in its right subtree are smaller than its key', 'All keys in the tree are equal', 'Keys in its left subtree are smaller and keys in its right subtree are larger than its key', 'The left child is always a leaf'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q115', 4, 'If h is the height of a binary search tree, searching for a key (recursively or iteratively) takes:', ARRAY['O(1) time', 'O(h) time', 'O(h^2) time', 'O(n^2) time'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q116', 4, 'In a binary search tree, a new node is always inserted as a:', ARRAY['Root node', 'Internal node', 'Left child of the root', 'Leaf node'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q117', 4, 'The keys 10, 12, 5, 4, 20, 8, 7, 15, 13 are inserted, in this order, into an initially empty binary search tree. Taking the height of a tree with a single node as 0, the height of the resulting tree is:', ARRAY['3', '5', '4', '6'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q118', 4, 'The keys 10, 12, 5, 4, 20, 8, 7, 15, 13 are inserted, in this order, into an initially empty binary search tree. Its preorder traversal is:', ARRAY['10 5 4 8 7 12 20 15 13', '4 5 7 8 10 12 13 15 20', '10 5 12 4 8 20 7 15 13', '10 12 5 4 20 8 7 15 13'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q119', 4, 'To delete a node having two children from a binary search tree, the node is replaced by:', ARRAY['Its parent node', 'The smallest key in its left subtree or the largest key in its right subtree', 'Either the largest key in its left subtree or the smallest key in its right subtree', 'The root of the tree'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M4-Q120', 4, 'In the binary search tree built from the keys 10, 12, 5, 4, 20, 8, 7, 15, 13, the root 10 is deleted by replacing it with the largest key of its left subtree. Which key becomes the replacement?', ARRAY['7', '12', '5', '8'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q121', 5, 'The length of a path in a graph is:', ARRAY['The number of vertices in the path', 'The number of edges in the path', 'The sum of the degrees of its vertices', 'The number of cycles in the path'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q122', 5, 'A graph G = (V, E) consists of:', ARRAY['A set of edges only', 'A set of vertices only, with no relation between them', 'A finite non-empty set of vertices V and a set E of pairs of vertices called edges', 'A set of nodes arranged in levels'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q123', 5, 'In an undirected graph, the pairs (u, v) and (v, u):', ARRAY['Represent two different edges', 'Represent the same edge', 'Represent a self loop', 'Cannot both be present in the graph'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q124', 5, 'How many edges does a complete undirected graph with 6 vertices have?', ARRAY['30', '12', '21', '15'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q125', 5, 'An edge of the form (v, v), which starts and ends at the same vertex, is called a:', ARRAY['Multi-edge', 'Cycle of length two', 'Weighted edge', 'Self loop (self edge)'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q126', 5, 'For the directed graph shown in the figure, the in-degree and the out-degree of vertex c are, respectively: a b d c', ARRAY['1 and 2', '2 and 1', '2 and 2', '3 and 1'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q127', 5, 'A directed graph G is said to be strongly connected if:', ARRAY['For every pair of distinct vertices u and v there is a directed path from u to v and from v to u', 'It contains no cycles', 'Every vertex has at least one outgoing edge', 'Every vertex has in-degree equal to its out-degree'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q128', 5, 'The adjacency matrix of an undirected graph is always:', ARRAY['Symmetric', 'Upper triangular', 'A diagonal matrix', 'An identity matrix'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q129', 5, 'For an undirected graph with n vertices and e edges, the adjacency list representation requires an array of size n and how many chain nodes?', ARRAY['e', 'n + e', 'n^2', '2e'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q130', 5, 'In the adjacency multilist representation of a graph:', ARRAY['Each edge is represented by two nodes, one in each end vertex''s list', 'Each vertex is represented by n nodes', 'Only the edge weights are stored, not the vertices', 'Each edge is represented by exactly one node, which appears in the lists of both of its end vertices'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q131', 5, 'Which data structure is used to maintain the current position in the adjacency lists during depth first search?', ARRAY['Queue', 'Priority queue', 'Stack', 'Hash table'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q132', 5, 'Breadth first search of a graph uses which data structure to hold the visited vertices whose adjacency lists are yet to be examined?', ARRAY['Stack', 'Queue', 'Binary tree', 'Array of weights'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q133', 5, 'For a graph with n vertices and e edges, the time taken by depth first search when the graph is represented by an adjacency list and by an adjacency matrix is, respectively:', ARRAY['O(e) and O(n^2)', 'O(n^2) and O(e)', 'O(n) and O(n)', 'O(e) and O(e)'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q134', 5, 'A depth first search is started from vertex 0 of the undirected graph in the figure. The adjacency lists are 0: 1, 2; 1: 0, 3, 4; 2: 0, 4; 3: 1; 4: 1, 2, and the vertices of each list are examined in the given order. The vertices are visited in the order: 0 1 2 3 4', ARRAY['0 1 3 4 2', '0 1 2 3 4', '0 2 4 1 3', '0 1 4 2 3'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q135', 5, 'A directed graph has the adjacency lists 0: 2, 1, 3; 1: 4; 2: 5, 4; 3: 5; 4: 6; 5: 6; 6: (none). A breadth first search is started from vertex 0 and the adjacency lists are scanned in the given order. The vertices are visited in the order:', ARRAY['0 1 2 3 4 5 6', '0 2 1 3 5 4 6', '0 2 5 6 4 1 3', '0 2 1 3 4 5 6'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q136', 5, 'Insertion sort (as given in the notes) is applied to the list 5, 2, 4, 6, 1, 3. The total number of times an element is shifted one position to the right (a[i+1] = a[i]) during the sort is:', ARRAY['9', '10', '8', '15'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q137', 5, 'Radix sort (least significant digit first, with each bucket preserving the input order) is applied to 348, 143, 361, 423, 538, 128, 321, 543, 366. The list after the first pass (units digit) is:', ARRAY['321 361 143 423 543 366 538 348 128', '128 143 321 348 361 366 423 538 543', '361 321 143 423 543 366 348 538 128', '348 143 361 423 538 128 321 543 366'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q138', 5, 'If each number in a list has s digits (radix d), the radix sort algorithm requires:', ARRAY['d passes', 's passes', 'n passes', 'log n passes'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q139', 5, 'The function f used in address calculation sort must be order preserving, which means:', ARRAY['If x <= y then f(x) <= f(y)', 'If x <= y then f(x) >= f(y)', 'f(x) is different for every key x', 'f(x) is chosen randomly for every key'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q140', 5, 'In hashing, a collision occurs when:', ARRAY['A key is not found in the hash table', 'The hash table becomes empty', 'Two or more keys map to the same memory location', 'The hash function returns a negative value'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q141', 5, 'In the division method of hashing, the hash function is:', ARRAY['h(x) = x div M', 'h(x) = x * M', 'h(x) = M - x', 'h(x) = x mod M'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q142', 5, 'A hash table of size 10 uses H(k) = k mod 10 with linear probing. The keys 72, 27, 36, 24, 63, 81, 92, 101 are inserted in this order. At which index is the key 101 stored?', ARRAY['5', '8', '1', '9'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q143', 5, 'The keys 72, 27, 36, 24, 63, 81, 92, 101 are stored, in this order, in a hash table of size 10 using H(k) = k mod 10 and linear probing. The average search length (total probes needed to find all 8 keys divided by 8) is:', ARRAY['2.0', '1.5', '2.25', '3.0'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q144', 5, 'A hash table of size 10 uses H(k) = k mod 10 with quadratic probing (probes h, h+1, h+4, h+9, ...). The keys 22, 32 and 42 are inserted in this order. At which index is 42 stored?', ARRAY['4', '3', '5', '6'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q145', 5, 'Double hashing with H1(key) = key % 10 and H2(key) = 7 - (key % 7) is used, and a collision is resolved with (H1(key) + i x H2(key)) % 10. The keys 37, 90, 45, 22, 17, 49, 55 are inserted in this order. At which index is the key 17 stored?', ARRAY['1', '8', '4', '7'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q146', 5, 'Using the folding method for a hash table with 100 locations, the key 123456 is divided into the parts 12, 34 and 56, which are added, ignoring any carry. The hash value is:', ARRAY['102', '12', '56', '2 (that is, 02)'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q147', 5, 'Words are stored using chaining in a table of size 5 with H(str) = (sum of the positions of its letters in the English alphabet) % 5. The words like, a, tree, you, first, a, place, to are inserted in this order at the rear of their chains. The words in the chain of index 2 are:', ARRAY['a, you, a', 'tree, first, place', 'like, first, place', 'like, tree, place'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q148', 5, 'In rehashing, when the hash table becomes nearly full:', ARRAY['The entries are copied to the same positions of a bigger table', 'A new table of double the size is created and every entry is re-inserted using its newly computed hash value', 'The size of the table is halved and the entries are rehashed', 'All the chains are deleted and the table is emptied'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q149', 5, 'Which of the following is a drawback of static hashing?', ARRAY['The table size is fixed, so it cannot accommodate data growth and collisions increase as the data grows', 'It requires a directory of pointers that must be doubled', 'It cannot use chaining or linear probing', 'The hash function cannot be computed in constant time'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'DSA-M5-Q150', 5, 'Which statement about dynamic hashing is correct?', ARRAY['Linear hashing uses a directory that is doubled, whereas extendible hashing splits buckets in round-robin order', 'Both extendible and linear hashing use a table of fixed size', 'Extendible hashing uses a directory that is doubled, splitting only the bucket that overflowed, whereas linear hashing uses no directory and splits buckets in round-robin order', 'Extendible hashing needs overflow pages, whereas linear hashing needs none'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


END $$;


DO $$
DECLARE
    v_sub_id bigint;
    v_bank_id bigint;
    v_creator_id bigint;
BEGIN
    SELECT id INTO v_sub_id FROM subject WHERE code = '21CS53' LIMIT 1;
    SELECT id INTO v_creator_id FROM account WHERE username = 'hod.cse' LIMIT 1;
    IF v_creator_id IS NULL THEN
        SELECT id INTO v_creator_id FROM account WHERE role = 'HOD' LIMIT 1;
    END IF;
    IF v_creator_id IS NULL THEN
        v_creator_id := 1;
    END IF;

    -- Ensure question_bank header
    SELECT id INTO v_bank_id FROM question_bank 
    WHERE subject_id = v_sub_id AND department_id = 2 AND semester = 5 LIMIT 1;

    IF v_bank_id IS NULL THEN
        INSERT INTO question_bank (department_id, subject_id, academic_session, semester, title, created_by, state, total_questions)
        VALUES (2, v_sub_id, '2025-26', 5, 'Logic Design & Computer Organization Question Bank (60 MCQs)', v_creator_id, 'FINALIZED', 60)
        RETURNING id INTO v_bank_id;
    ELSE
        UPDATE question_bank SET total_questions = 60, state = 'FINALIZED' WHERE id = v_bank_id;
    END IF;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q001', 1, 'Which of the following laws is valid in Boolean algebra but NOT valid in ordinary algebra?', ARRAY['x + y = y + x', '(x·y)·z = x·(y·z)', 'x·(y + z) = x·y + x·z', 'x + (y·z) = (x + y)·(x + z)'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q002', 1, 'Who introduced the two-valued Boolean algebra called ''switching algebra'' in 1938?', ARRAY['C. E. Shannon', 'Augustus De Morgan', 'E. V. Huntington', 'George Boole'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q003', 1, 'According to the duality principle, the dual of the expression x + 0 = x is:', ARRAY['x · 1 = x', 'x · 0 = x', 'x + 1 = x', 'x'' + 1 = x'''], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q004', 1, 'Simplify the expression x + x''y.', ARRAY['xy', 'y', 'x + y', 'x'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q005', 1, 'According to De Morgan''s theorem, (x·y)'' is equal to:', ARRAY['x + y', 'x · y''', 'x'' · y''', 'x'' + y'''], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q006', 1, 'The correct order of precedence of Boolean operators (highest to lowest) is:', ARRAY['NOT, Parentheses, OR, AND', 'Parentheses, AND, NOT, OR', 'Parentheses, NOT, AND, OR', 'Parentheses, OR, AND, NOT'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q007', 1, 'A Boolean function of 4 variables has a truth table with how many rows?', ARRAY['32', '4', '16', '8'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q008', 1, 'How many different Boolean functions can be formed with 3 binary variables?', ARRAY['256', '65536', '8', '64'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q009', 1, 'If F(A, B, C) = Σ(1, 4, 5, 6, 7), then the complement F'' in minterm form is:', ARRAY['Σ(1, 4, 5)', 'Σ(0, 2, 3)', 'Σ(0, 1, 2)', 'Σ(2, 3, 7)'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q010', 1, 'The function F(x, y, z) = Π(0, 2, 4, 5) expressed as a sum of minterms is:', ARRAY['Σ(1, 2, 6, 7)', 'Σ(0, 2, 4, 5)', 'Σ(1, 3, 6, 7)', 'Σ(1, 3, 5, 7)'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q011', 1, 'For three variables x, y, z, the maxterm M3 is:', ARRAY['x'' + y'' + z', 'x + y'' + z''', 'x'' + y + z', 'x'' y z'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q012', 1, 'Using the K-map shown, the simplified SOP expression for F(x, y, z) = Σ(2, 3, 4, 5) is:', ARRAY['y + z', 'xy + x''y''', 'x''y + xy''', 'x''z + xz'''], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q013', 1, 'Using the K-map shown, the simplified expression for F(w, x, y, z) is:', ARRAY['y'' + w''z'' + xz''', 'y'' + w''z + xz''', 'y'' + wz + xz', 'y + w''z'' + xz'''], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q014', 1, 'The K-map shows F = Σ(1, 3, 7, 11, 15) with don''t-care conditions d = Σ(0, 2, 5). A minimal SOP expression is:', ARRAY['F = yz'' + w''z', 'F = y''z + w''x''', 'F = yz + wx', 'F = yz + w''x'''], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q015', 1, 'For the K-map shown (F = Σ(0, 1, 2, 5, 8, 9, 10)), the minimal product-of-sums (POS) expression is:', ARRAY['(A + B'')(C'' + D'')(B + D)', '(A'' + B'')(C + D)(B'' + D)', '(A + B)(C + D)(B + D'')', '(A'' + B'')(C'' + D'')(B'' + D)'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q016', 1, 'Why are the rows and columns of a K-map labelled in Gray-code order (00, 01, 11, 10)?', ARRAY['So that adjacent cells differ in only one variable', 'To arrange minterms in binary counting order', 'To reduce the number of cells', 'To make the map symmetric about the diagonal'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q017', 1, 'In a 4-variable K-map, a group of eight adjacent 1s yields a product term with how many literals?', ARRAY['1', '2', '3', '0'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q018', 1, 'The shaded cell in the 3-variable K-map shown (row x = 1, column yz = 10) corresponds to minterm:', ARRAY['m4', 'm7', 'm5', 'm6'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q019', 1, 'Which pair of gates is called ''universal'' because any Boolean function can be built using only one of them?', ARRAY['NOT and AND', 'XOR and XNOR', 'NAND and NOR', 'AND and OR'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q020', 1, 'Which of the following gate operations is NOT associative, so the multi-input gate is defined as a complemented OR?', ARRAY['AND', 'NOR', 'OR', 'XOR'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q021', 1, 'A three-input exclusive-OR gate output equals 1 when:', ARRAY['an even number of inputs are 1', 'all inputs are 1', 'an odd number of inputs are 1', 'at least one input is 0'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q022', 1, 'The output of the cascaded NAND circuit shown, F = [(ABC)''(DE)'']'', simplifies to:', ARRAY['ABC + DE', '(ABC)(DE)', 'A + B + C + D + E', '(ABC)'' + (DE)'''], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q023', 1, 'The output F of the logic circuit shown is:', ARRAY['F = x''z + xy''', 'F = xz + x''y''', 'F = (x'' + z)(x + y'')', 'F = x''y + xz'''], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q024', 1, 'In the Quine–McCluskey tabular method, the first step is to:', ARRAY['group the minterms according to the number of 1s in their binary form', 'draw the K-map', 'apply De Morgan''s theorem to all terms', 'find the essential prime implicants'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q025', 1, 'Using the Quine–McCluskey method, F(W, X, Y, Z) = Σm(2, 6, 8, 9, 10, 11, 14, 15) simplifies to:', ARRAY['Y''Z + W''X + WY', 'YZ'' + WX'' + WY', 'YZ + WX + W''Y', 'YZ'' + W''X'' + WY'''], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q026', 1, 'In a K-map, a don''t-care condition (X) may be treated as:', ARRAY['ignored and left out of every group', 'either 0 or 1, whichever gives the simpler expression', 'always 0', 'always 1'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q027', 1, 'Which IC logic family is preferred in systems that require low power consumption?', ARRAY['ECL', 'TTL', 'I²L', 'CMOS'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q028', 1, 'Which IC logic family is used in systems that require very high-speed operation?', ARRAY['MOS', 'ECL', 'CMOS', 'I²L'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q029', 1, 'A 14-pin SSI package (two pins for power supply) can accommodate how many two-input gates?', ARRAY['4', '3', '7', '6'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q030', 1, 'In a negative-logic system, logic-1 is represented by:', ARRAY['the low voltage level (L)', 'the high voltage level (H)', '0 volts always', 'a negative voltage always'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q031', 2, 'A combinational circuit is one whose output at any time depends on:', ARRAY['the present inputs and past inputs', 'only the present combination of inputs', 'the stored state only', 'a clock signal only'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q032', 2, 'Which of the following is NOT a combinational circuit?', ARRAY['Binary counter', 'Decoder', 'Adder', 'Multiplexer'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q033', 2, 'The circuit shown, built from an XOR gate and an AND gate with inputs A and B, is a:', ARRAY['comparator', 'half subtractor', 'full adder', 'half adder'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q034', 2, 'For a half adder with inputs x = 1 and y = 1, the outputs (Sum, Carry) are:', ARRAY['Sum = 1, Carry = 1', 'Sum = 1, Carry = 0', 'Sum = 0, Carry = 1', 'Sum = 0, Carry = 0'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q035', 2, 'For a full adder with inputs x = 1, y = 0 and z (carry-in) = 1, the output carry C is:', ARRAY['1 (and Sum = 1)', '0 (and Sum = 1)', '1 (and Sum = 0)', '0 (and Sum = 0)'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q036', 2, 'In the full adder shown (two half adders and one extra gate), the extra gate that produces the output carry is a(n):', ARRAY['NAND gate', 'OR gate', 'AND gate', 'XOR gate'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q037', 2, 'For a half subtractor with minuend x = 0 and subtrahend y = 1, the borrow output B is:', ARRAY['1', 'Cannot be determined', 'x', '0'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q038', 2, 'A full adder can be converted into a full subtractor by:', ARRAY['replacing the XOR gates with AND gates', 'complementing input x before applying it to the gates that form the carry (borrow) output', 'complementing the output sum', 'complementing input y before the sum gate'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q039', 2, 'For a full subtractor with x = 0, y = 1 and previous borrow z = 1, the outputs (Difference D, Borrow B) are:', ARRAY['D = 0, B = 0', 'D = 1, B = 1', 'D = 1, B = 0', 'D = 0, B = 1'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q040', 2, 'The excess-3 code for decimal digit 5 (BCD 0101) is:', ARRAY['0101', '1001', '0111', '1000'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q041', 2, 'In the BCD-to-excess-3 code converter, the output bit z (least significant) is given by (inputs A, B, C, D):', ARRAY['z = CD''', 'z = C ⊕ D', 'z = D''', 'z = D'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q042', 2, 'For the NAND circuit shown, the output F is:', ARRAY['AB + ACD + BC''', 'AB + ACD'' + B''C', 'AB + CD + B''C''', 'A(B'' + CD) + BC'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q043', 2, 'An AND operation can be realised using NAND gates only by:', ARRAY['inverting both inputs and then using a NAND gate', 'a single NAND gate', 'a NAND gate followed by a NAND gate wired as an inverter', 'two NAND gates in parallel'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q044', 2, 'An n-variable exclusive-OR function is equal to 1 for those minterms that have:', ARRAY['an even number of 1s', 'an odd number of 1s', 'all variables equal to 1', 'exactly one 0'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q045', 2, 'In the 4-bit ripple-carry adder shown, the delay of the adder is mainly decided by:', ARRAY['the number of output pins', 'the time taken by the carry to propagate through all full adders', 'the clock frequency', 'the delay of the sum XOR gates only'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q046', 2, 'In a look-ahead carry adder, with carry generate Gi = AiBi and carry propagate Pi = Ai ⊕ Bi, the carry C2 is:', ARRAY['G1 ⊕ P1C1', 'G1·P1 + C1', 'G1 + P1C1', 'P1 + G1C1'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q047', 2, 'In a look-ahead carry generator, the carry C3 is expressed as:', ARRAY['G2P2 + G1P1C1', 'G2 + G1 + C1', 'G2 + P2G1 + P2P1C1', 'G2 + P2 + P1C1'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q048', 2, 'A BCD adder corrects an invalid binary sum (greater than 9) by adding:', ARRAY['1010', '0110', '0011', '1001'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q049', 2, 'Adding the BCD digits 7 and 8 using a BCD adder gives the corrected BCD result:', ARRAY['0000 1111', '0001 0101', '0001 0011', '0001 1111'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q050', 2, 'The BCD adder block diagram shown uses how many 4-bit binary adders?', ARRAY['3', '4', '1', '2'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q051', 2, 'In a magnitude comparator, two 4-bit numbers A and B are equal when:', ARRAY['A0 = B0 and A3 ≠ B3', 'any one pair of bits is equal', 'A3 = B3 only', 'all pairs of corresponding bits are equal (xi = AiBi + Ai''Bi'' = 1 for every i)'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q052', 2, 'In a 3-to-8 line decoder, when the input xyz = 101, the active output is:', ARRAY['D4', 'D3', 'D6', 'D5'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q053', 2, 'A full adder is implemented using a 3×8 decoder and two OR gates, as partly shown (S = Σ(1, 2, 4, 7)). The OR gate for the carry C must be connected to decoder outputs:', ARRAY['3, 5, 6, 7', '1, 2, 4, 7', '2, 3, 6, 7', '0, 1, 2, 4'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q054', 2, 'In the circuit shown (two 3×8 decoders with enable inputs, w inverted for the top decoder), when w = 1 the outputs that generate minterms are:', ARRAY['all outputs are 1', 'D8 to D15 (bottom decoder enabled)', 'D0 to D7 (top decoder enabled)', 'all outputs are 0'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q055', 2, 'In an octal-to-binary encoder, the output bit x (most significant) is 1 for octal digits:', ARRAY['2, 3, 6 or 7', '4, 5, 6 or 7 (x = D4 + D5 + D6 + D7)', '1, 3, 5 or 7', '0, 1, 2 or 3'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q056', 2, 'How many selection lines are needed for an 8-to-1 multiplexer?', ARRAY['8', '3', '4', '2'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q057', 2, 'The 4×1 multiplexer shown has inputs I0 = 0, I1 = 1, I2 = A, I3 = A'' and select lines S1 = B, S0 = C. The function F(A, B, C) implemented is:', ARRAY['Σ(1, 3, 5, 6)', 'Σ(1, 3, 5, 7)', 'Σ(0, 2, 4, 7)', 'Σ(1, 2, 5, 6)'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q058', 2, 'A ROM that has 5 address input lines and 8 output lines is described as a:', ARRAY['5 × 8 ROM', '32 × 8 ROM', '8 × 32 ROM', '16 × 8 ROM'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q059', 2, 'For the PLA program table shown (3 inputs, 3 product terms, 2 outputs), the number of programmed links 2n×k + k×m + m is:', ARRAY['32', '18', '24', '26'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q060', 2, 'Compared with a ROM, a PLA replaces the decoder with:', ARRAY['a bank of OR gates only', 'a set of flip-flops', 'a multiplexer', 'a programmable group of AND gates generating product terms'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


END $$;


DO $$
DECLARE
    v_sub_id bigint;
    v_bank_id bigint;
    v_creator_id bigint;
BEGIN
    SELECT id INTO v_sub_id FROM subject WHERE code = '21CS33' LIMIT 1;
    SELECT id INTO v_creator_id FROM account WHERE username = 'hod.cse' LIMIT 1;
    IF v_creator_id IS NULL THEN
        SELECT id INTO v_creator_id FROM account WHERE role = 'HOD' LIMIT 1;
    END IF;
    IF v_creator_id IS NULL THEN
        v_creator_id := 1;
    END IF;

    -- Ensure question_bank header
    SELECT id INTO v_bank_id FROM question_bank 
    WHERE subject_id = v_sub_id AND department_id = 2 AND semester = 3 LIMIT 1;

    IF v_bank_id IS NULL THEN
        INSERT INTO question_bank (department_id, subject_id, academic_session, semester, title, created_by, state, total_questions)
        VALUES (2, v_sub_id, '2025-26', 3, 'Logic Design & Computer Organization Question Bank (60 MCQs)', v_creator_id, 'FINALIZED', 60)
        RETURNING id INTO v_bank_id;
    ELSE
        UPDATE question_bank SET total_questions = 60, state = 'FINALIZED' WHERE id = v_bank_id;
    END IF;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q001', 1, 'Which of the following laws is valid in Boolean algebra but NOT valid in ordinary algebra?', ARRAY['x + y = y + x', '(x·y)·z = x·(y·z)', 'x·(y + z) = x·y + x·z', 'x + (y·z) = (x + y)·(x + z)'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q002', 1, 'Who introduced the two-valued Boolean algebra called ''switching algebra'' in 1938?', ARRAY['C. E. Shannon', 'Augustus De Morgan', 'E. V. Huntington', 'George Boole'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q003', 1, 'According to the duality principle, the dual of the expression x + 0 = x is:', ARRAY['x · 1 = x', 'x · 0 = x', 'x + 1 = x', 'x'' + 1 = x'''], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q004', 1, 'Simplify the expression x + x''y.', ARRAY['xy', 'y', 'x + y', 'x'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q005', 1, 'According to De Morgan''s theorem, (x·y)'' is equal to:', ARRAY['x + y', 'x · y''', 'x'' · y''', 'x'' + y'''], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q006', 1, 'The correct order of precedence of Boolean operators (highest to lowest) is:', ARRAY['NOT, Parentheses, OR, AND', 'Parentheses, AND, NOT, OR', 'Parentheses, NOT, AND, OR', 'Parentheses, OR, AND, NOT'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q007', 1, 'A Boolean function of 4 variables has a truth table with how many rows?', ARRAY['32', '4', '16', '8'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q008', 1, 'How many different Boolean functions can be formed with 3 binary variables?', ARRAY['256', '65536', '8', '64'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q009', 1, 'If F(A, B, C) = Σ(1, 4, 5, 6, 7), then the complement F'' in minterm form is:', ARRAY['Σ(1, 4, 5)', 'Σ(0, 2, 3)', 'Σ(0, 1, 2)', 'Σ(2, 3, 7)'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q010', 1, 'The function F(x, y, z) = Π(0, 2, 4, 5) expressed as a sum of minterms is:', ARRAY['Σ(1, 2, 6, 7)', 'Σ(0, 2, 4, 5)', 'Σ(1, 3, 6, 7)', 'Σ(1, 3, 5, 7)'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q011', 1, 'For three variables x, y, z, the maxterm M3 is:', ARRAY['x'' + y'' + z', 'x + y'' + z''', 'x'' + y + z', 'x'' y z'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q012', 1, 'Using the K-map shown, the simplified SOP expression for F(x, y, z) = Σ(2, 3, 4, 5) is:', ARRAY['y + z', 'xy + x''y''', 'x''y + xy''', 'x''z + xz'''], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q013', 1, 'Using the K-map shown, the simplified expression for F(w, x, y, z) is:', ARRAY['y'' + w''z'' + xz''', 'y'' + w''z + xz''', 'y'' + wz + xz', 'y + w''z'' + xz'''], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q014', 1, 'The K-map shows F = Σ(1, 3, 7, 11, 15) with don''t-care conditions d = Σ(0, 2, 5). A minimal SOP expression is:', ARRAY['F = yz'' + w''z', 'F = y''z + w''x''', 'F = yz + wx', 'F = yz + w''x'''], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q015', 1, 'For the K-map shown (F = Σ(0, 1, 2, 5, 8, 9, 10)), the minimal product-of-sums (POS) expression is:', ARRAY['(A + B'')(C'' + D'')(B + D)', '(A'' + B'')(C + D)(B'' + D)', '(A + B)(C + D)(B + D'')', '(A'' + B'')(C'' + D'')(B'' + D)'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q016', 1, 'Why are the rows and columns of a K-map labelled in Gray-code order (00, 01, 11, 10)?', ARRAY['So that adjacent cells differ in only one variable', 'To arrange minterms in binary counting order', 'To reduce the number of cells', 'To make the map symmetric about the diagonal'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q017', 1, 'In a 4-variable K-map, a group of eight adjacent 1s yields a product term with how many literals?', ARRAY['1', '2', '3', '0'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q018', 1, 'The shaded cell in the 3-variable K-map shown (row x = 1, column yz = 10) corresponds to minterm:', ARRAY['m4', 'm7', 'm5', 'm6'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q019', 1, 'Which pair of gates is called ''universal'' because any Boolean function can be built using only one of them?', ARRAY['NOT and AND', 'XOR and XNOR', 'NAND and NOR', 'AND and OR'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q020', 1, 'Which of the following gate operations is NOT associative, so the multi-input gate is defined as a complemented OR?', ARRAY['AND', 'NOR', 'OR', 'XOR'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q021', 1, 'A three-input exclusive-OR gate output equals 1 when:', ARRAY['an even number of inputs are 1', 'all inputs are 1', 'an odd number of inputs are 1', 'at least one input is 0'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q022', 1, 'The output of the cascaded NAND circuit shown, F = [(ABC)''(DE)'']'', simplifies to:', ARRAY['ABC + DE', '(ABC)(DE)', 'A + B + C + D + E', '(ABC)'' + (DE)'''], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q023', 1, 'The output F of the logic circuit shown is:', ARRAY['F = x''z + xy''', 'F = xz + x''y''', 'F = (x'' + z)(x + y'')', 'F = x''y + xz'''], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q024', 1, 'In the Quine–McCluskey tabular method, the first step is to:', ARRAY['group the minterms according to the number of 1s in their binary form', 'draw the K-map', 'apply De Morgan''s theorem to all terms', 'find the essential prime implicants'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q025', 1, 'Using the Quine–McCluskey method, F(W, X, Y, Z) = Σm(2, 6, 8, 9, 10, 11, 14, 15) simplifies to:', ARRAY['Y''Z + W''X + WY', 'YZ'' + WX'' + WY', 'YZ + WX + W''Y', 'YZ'' + W''X'' + WY'''], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q026', 1, 'In a K-map, a don''t-care condition (X) may be treated as:', ARRAY['ignored and left out of every group', 'either 0 or 1, whichever gives the simpler expression', 'always 0', 'always 1'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q027', 1, 'Which IC logic family is preferred in systems that require low power consumption?', ARRAY['ECL', 'TTL', 'I²L', 'CMOS'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q028', 1, 'Which IC logic family is used in systems that require very high-speed operation?', ARRAY['MOS', 'ECL', 'CMOS', 'I²L'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q029', 1, 'A 14-pin SSI package (two pins for power supply) can accommodate how many two-input gates?', ARRAY['4', '3', '7', '6'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M1-Q030', 1, 'In a negative-logic system, logic-1 is represented by:', ARRAY['the low voltage level (L)', 'the high voltage level (H)', '0 volts always', 'a negative voltage always'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q031', 2, 'A combinational circuit is one whose output at any time depends on:', ARRAY['the present inputs and past inputs', 'only the present combination of inputs', 'the stored state only', 'a clock signal only'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q032', 2, 'Which of the following is NOT a combinational circuit?', ARRAY['Binary counter', 'Decoder', 'Adder', 'Multiplexer'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q033', 2, 'The circuit shown, built from an XOR gate and an AND gate with inputs A and B, is a:', ARRAY['comparator', 'half subtractor', 'full adder', 'half adder'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q034', 2, 'For a half adder with inputs x = 1 and y = 1, the outputs (Sum, Carry) are:', ARRAY['Sum = 1, Carry = 1', 'Sum = 1, Carry = 0', 'Sum = 0, Carry = 1', 'Sum = 0, Carry = 0'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q035', 2, 'For a full adder with inputs x = 1, y = 0 and z (carry-in) = 1, the output carry C is:', ARRAY['1 (and Sum = 1)', '0 (and Sum = 1)', '1 (and Sum = 0)', '0 (and Sum = 0)'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q036', 2, 'In the full adder shown (two half adders and one extra gate), the extra gate that produces the output carry is a(n):', ARRAY['NAND gate', 'OR gate', 'AND gate', 'XOR gate'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q037', 2, 'For a half subtractor with minuend x = 0 and subtrahend y = 1, the borrow output B is:', ARRAY['1', 'Cannot be determined', 'x', '0'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q038', 2, 'A full adder can be converted into a full subtractor by:', ARRAY['replacing the XOR gates with AND gates', 'complementing input x before applying it to the gates that form the carry (borrow) output', 'complementing the output sum', 'complementing input y before the sum gate'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q039', 2, 'For a full subtractor with x = 0, y = 1 and previous borrow z = 1, the outputs (Difference D, Borrow B) are:', ARRAY['D = 0, B = 0', 'D = 1, B = 1', 'D = 1, B = 0', 'D = 0, B = 1'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q040', 2, 'The excess-3 code for decimal digit 5 (BCD 0101) is:', ARRAY['0101', '1001', '0111', '1000'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q041', 2, 'In the BCD-to-excess-3 code converter, the output bit z (least significant) is given by (inputs A, B, C, D):', ARRAY['z = CD''', 'z = C ⊕ D', 'z = D''', 'z = D'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q042', 2, 'For the NAND circuit shown, the output F is:', ARRAY['AB + ACD + BC''', 'AB + ACD'' + B''C', 'AB + CD + B''C''', 'A(B'' + CD) + BC'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q043', 2, 'An AND operation can be realised using NAND gates only by:', ARRAY['inverting both inputs and then using a NAND gate', 'a single NAND gate', 'a NAND gate followed by a NAND gate wired as an inverter', 'two NAND gates in parallel'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q044', 2, 'An n-variable exclusive-OR function is equal to 1 for those minterms that have:', ARRAY['an even number of 1s', 'an odd number of 1s', 'all variables equal to 1', 'exactly one 0'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q045', 2, 'In the 4-bit ripple-carry adder shown, the delay of the adder is mainly decided by:', ARRAY['the number of output pins', 'the time taken by the carry to propagate through all full adders', 'the clock frequency', 'the delay of the sum XOR gates only'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q046', 2, 'In a look-ahead carry adder, with carry generate Gi = AiBi and carry propagate Pi = Ai ⊕ Bi, the carry C2 is:', ARRAY['G1 ⊕ P1C1', 'G1·P1 + C1', 'G1 + P1C1', 'P1 + G1C1'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q047', 2, 'In a look-ahead carry generator, the carry C3 is expressed as:', ARRAY['G2P2 + G1P1C1', 'G2 + G1 + C1', 'G2 + P2G1 + P2P1C1', 'G2 + P2 + P1C1'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q048', 2, 'A BCD adder corrects an invalid binary sum (greater than 9) by adding:', ARRAY['1010', '0110', '0011', '1001'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q049', 2, 'Adding the BCD digits 7 and 8 using a BCD adder gives the corrected BCD result:', ARRAY['0000 1111', '0001 0101', '0001 0011', '0001 1111'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q050', 2, 'The BCD adder block diagram shown uses how many 4-bit binary adders?', ARRAY['3', '4', '1', '2'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q051', 2, 'In a magnitude comparator, two 4-bit numbers A and B are equal when:', ARRAY['A0 = B0 and A3 ≠ B3', 'any one pair of bits is equal', 'A3 = B3 only', 'all pairs of corresponding bits are equal (xi = AiBi + Ai''Bi'' = 1 for every i)'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q052', 2, 'In a 3-to-8 line decoder, when the input xyz = 101, the active output is:', ARRAY['D4', 'D3', 'D6', 'D5'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q053', 2, 'A full adder is implemented using a 3×8 decoder and two OR gates, as partly shown (S = Σ(1, 2, 4, 7)). The OR gate for the carry C must be connected to decoder outputs:', ARRAY['3, 5, 6, 7', '1, 2, 4, 7', '2, 3, 6, 7', '0, 1, 2, 4'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q054', 2, 'In the circuit shown (two 3×8 decoders with enable inputs, w inverted for the top decoder), when w = 1 the outputs that generate minterms are:', ARRAY['all outputs are 1', 'D8 to D15 (bottom decoder enabled)', 'D0 to D7 (top decoder enabled)', 'all outputs are 0'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q055', 2, 'In an octal-to-binary encoder, the output bit x (most significant) is 1 for octal digits:', ARRAY['2, 3, 6 or 7', '4, 5, 6 or 7 (x = D4 + D5 + D6 + D7)', '1, 3, 5 or 7', '0, 1, 2 or 3'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q056', 2, 'How many selection lines are needed for an 8-to-1 multiplexer?', ARRAY['8', '3', '4', '2'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q057', 2, 'The 4×1 multiplexer shown has inputs I0 = 0, I1 = 1, I2 = A, I3 = A'' and select lines S1 = B, S0 = C. The function F(A, B, C) implemented is:', ARRAY['Σ(1, 3, 5, 6)', 'Σ(1, 3, 5, 7)', 'Σ(0, 2, 4, 7)', 'Σ(1, 2, 5, 6)'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q058', 2, 'A ROM that has 5 address input lines and 8 output lines is described as a:', ARRAY['5 × 8 ROM', '32 × 8 ROM', '8 × 32 ROM', '16 × 8 ROM'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q059', 2, 'For the PLA program table shown (3 inputs, 3 product terms, 2 outputs), the number of programmed links 2n×k + k×m + m is:', ARRAY['32', '18', '24', '26'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'LDCO-M2-Q060', 2, 'Compared with a ROM, a PLA replaces the decoder with:', ARRAY['a bank of OR gates only', 'a set of flip-flops', 'a multiplexer', 'a programmable group of AND gates generating product terms'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


END $$;


DO $$
DECLARE
    v_sub_id bigint;
    v_bank_id bigint;
    v_creator_id bigint;
BEGIN
    SELECT id INTO v_sub_id FROM subject WHERE code = 'MH25CS003' LIMIT 1;
    SELECT id INTO v_creator_id FROM account WHERE username = 'hod.cse' LIMIT 1;
    IF v_creator_id IS NULL THEN
        SELECT id INTO v_creator_id FROM account WHERE role = 'HOD' LIMIT 1;
    END IF;
    IF v_creator_id IS NULL THEN
        v_creator_id := 1;
    END IF;

    -- Ensure question_bank header
    SELECT id INTO v_bank_id FROM question_bank 
    WHERE subject_id = v_sub_id AND department_id = 2 AND semester = 5 LIMIT 1;

    IF v_bank_id IS NULL THEN
        INSERT INTO question_bank (department_id, subject_id, academic_session, semester, title, created_by, state, total_questions)
        VALUES (2, v_sub_id, '2025-26', 5, 'Operating Systems Complete Question Bank (150 MCQs)', v_creator_id, 'FINALIZED', 150)
        RETURNING id INTO v_bank_id;
    ELSE
        UPDATE question_bank SET total_questions = 150, state = 'FINALIZED' WHERE id = v_bank_id;
    END IF;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q001', 1, 'According to the notes, a data structure can be expressed as:', ARRAY['Data Structure = Organized data + Allowed operations', 'Data Structure = Algorithm + Flowchart', 'Data Structure = Program + Compiler', 'Data Structure = Input + Output'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q002', 1, 'A field K whose values uniquely determine a record in a file is called a:', ARRAY['Primary key', 'Group item', 'Entity set', 'Variable-length record'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q003', 1, 'Which of the following is a primitive data structure?', ARRAY['Array', 'Integer', 'Tree', 'Graph'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q004', 1, 'Which of the following is a non-linear data structure?', ARRAY['Stack', 'Queue', 'Linked list', 'Tree'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q005', 1, 'In data structure operations, merging means:', ARRAY['Arranging all data items in ascending or descending order', 'Combining the data items of two sorted lists into a single list', 'Finding whether a desired data item is present in a list', 'Reserving memory for the program elements'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q006', 1, 'A pointer is:', ARRAY['A variable that can store only integer constants', 'A special variable that contains the address of a memory location', 'A function that allocates memory at run time', 'A data type that stores a sequence of characters'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q007', 1, 'A pointer that has not been initialized with a valid address is known as a:', ARRAY['NULL pointer', 'Void pointer', 'Dangling (wild) pointer', 'Pointer to pointer'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q008', 1, 'Memory requested at run time using malloc() and calloc() is allocated from the:', ARRAY['Stack', 'Static (compile-time) data area', 'CPU registers', 'Heap'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q009', 1, 'Which dynamic memory allocation function initializes every allocated block to zero?', ARRAY['malloc()', 'realloc()', 'calloc()', 'free()'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q010', 1, 'Which statement correctly distinguishes calloc() from malloc()?', ARRAY['calloc() takes one argument and leaves the allocated memory uninitialized', 'calloc() takes two arguments (number of elements, element size) and initializes the memory to zero', 'calloc() releases previously allocated memory, while malloc() allocates it', 'calloc() allocates memory at compile time, while malloc() does it at run time'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q011', 1, 'If realloc() cannot extend an existing memory block in place, it:', ARRAY['Leaves the old block unchanged and returns a pointer to its first byte', 'Frees the old block and returns an uninitialized block without copying any data', 'Allocates a new block, copies the old contents into it and frees the old block', 'Always terminates the program with a run-time error'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q012', 1, 'What is the output of the following code? int a[5] = {10, 20, 30, 40, 50}; int *p = a; printf("%d %d", *(p + 2), 3[a]);', ARRAY['20 40', '30 30', 'Compilation error', '30 40'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q013', 1, 'Which declaration creates an array of 5 pointers to integers?', ARRAY['int *a;', 'int a[5];', 'int *a[5];', 'int **a;'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q014', 1, 'Binary search is applied on the sorted array {2, 5, 8, 12, 16, 23, 38, 56, 72, 91} with low = 0, high = 9 and mid = (low + high)/2 to find the key 23. How many times is mid computed before the key is found?', ARRAY['3', '2', '4', '5'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q015', 1, 'What is the output of the following code that inserts an item into an array? int a[10] = {5, 10, 15, 20}, n = 4, pos = 2, item = 12, i; for (i = n - 1; i >= pos; i--) a[i + 1] = a[i]; a[pos] = item; n = n + 1; for (i = 0; i < n; i++) printf("%d ", a[i]);', ARRAY['5 10 15 12 20', '5 10 12 15 20', '12 5 10 15 20', '5 10 12 20 20'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q016', 1, 'What is the output of the following code? int m[2][3] = { {1, 4, 2}, {3, 6, 8} }; int i, j, s = 0; for (i = 0; i < 2; i++) for (j = 0; j < 3; j++) if (i != j) s += m[i][j]; printf("%d", s);', ARRAY['24', '7', '21', '17'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q017', 1, 'To create a 2-D integer array of rows x cols dynamically using the pointer-to-pointer method of the notes, how many MALLOC (malloc) calls are needed in total?', ARRAY['1', 'rows x cols', 'rows + 1', 'cols + 1'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q018', 1, 'What is the output of the following code? int a = 10; int *p1 = &a; int **p2 = &p1; **p2 = **p2 + 5; printf("%d %d", a, *p1);', ARRAY['10 15', '15 10', '10 10', '15 15'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q019', 1, 'Which of the following structure definitions results in a syntax error?', ARRAY['struct str1 { int i; char c; } var1 = {10, ''A''};', 'struct str1 { int i = 10; char c = ''A''; };', 'struct str1 { int i; char c; }; struct str1 var1 = {10, ''A''};', 'struct str1 { int i; char c; float f; } s1, s2;'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q020', 1, 'Which of the following is a self-referential structure?', ARRAY['struct node { int data; struct node next; };', 'struct node { int data; int *next; };', 'struct node { int data; };', 'struct node { int data; struct node *next; };'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q021', 1, 'The size of a union is equal to the size of its:', ARRAY['Largest member', 'Smallest member', 'Sum of all members', 'First member'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q022', 1, 'Which statement about structures and unions is correct?', ARRAY['Altering one member of a structure alters the other members, but not in a union', 'In a structure each member has its own storage, whereas all members of a union share the same memory', 'A union allocates memory equal to the sum of the sizes of its members', 'All members of a union can be initialized at once, but only the first member of a structure can be'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q023', 1, 'Using the addpolynomial() logic of the notes (terms are stored in decreasing order of exponent and a term is attached only when its coefficient is non-zero), the sum of A(x) = 5x^3 + 4x^2 + 2 and B(x) = 3x^3 - 4x^2 + 7x is:', ARRAY['8x^3 + 0x^2 + 7x + 2', '8x^3 + 8x^2 + 7x + 2', '2x^3 + 8x^2 + 7x + 2', '8x^3 + 7x + 2'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q024', 1, 'A sparse matrix is a matrix that has:', ARRAY['A greater number of zero elements than non-zero elements', 'Only non-zero elements', 'More rows than columns', 'Non-zero elements only on its diagonal'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q025', 1, 'In the (row, column, value) triple representation of a sparse matrix, the first entry A[0] stores:', ARRAY['The first non-zero element of the matrix', 'The number of zero elements, rows and columns', 'The number of rows, the number of columns and the number of non-zero terms', 'The largest element and its row and column'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q026', 1, 'The 4 x 4 sparse matrix A shown below is stored as triples with B[0] = (4, 4, 5) for its transpose. Using the column-by-column transpose algorithm of the notes, what is B[4]? | 0  0  3  0 | A = | 0  0  0  8 | | 1  0  3  0 | | 0  0  7  0 |', ARRAY['(3, 1, 8)', '(2, 3, 7)', '(2, 2, 3)', '(0, 2, 1)'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q027', 1, 'For a sparse matrix with c columns and t non-zero terms, the transpose function of the notes (which scans all t terms once for every column) runs in time:', ARRAY['O(c x t)', 'O(c + t)', 'O(t)', 'O(c)'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q028', 1, 'A string in C is a sequence of characters terminated by the:', ARRAY['Null character ''\0''', 'Newline character ''\n''', 'Space character', 'Tab character ''\t'''], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q029', 1, 'What is the output of the following code? #include <string.h> char s[] = "Hello"; printf("%d", (int)(sizeof(s) + strlen(s)));', ARRAY['10', '12', '11', '5'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M1-Q030', 1, 'What is the output of the following code? char a[20] = "Data"; char b[] = "Struct"; strcat(a, b); printf("%s %d", a, (int)strlen(a));', ARRAY['DataStruct 10', 'DataStruct 11', 'StructData 10', 'Data 4'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q031', 2, 'In a stack, insertions (push) and deletions (pop) are made at one end called the:', ARRAY['Top', 'Front', 'Rear', 'Base'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q032', 2, 'Trying to push an element onto a stack that is already full is called:', ARRAY['Overflow', 'Underflow', 'Deadlock', 'Wrap-around'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q033', 2, 'Which auxiliary stack operation returns the last inserted element without removing it?', ARRAY['Pop()', 'Push()', 'Top()', 'Size()'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q034', 2, 'When a stack is implemented using an array, the value of top for an empty stack is initialized to:', ARRAY['-1', '0', '1', 'MAX_STACK_SIZE'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q035', 2, 'When a function is invoked, its stack frame placed on the system stack initially contains:', ARRAY['Only the local variables of the invoking function', 'The source code of the invoked function', 'A pointer to the previous stack frame and the return address', 'The final return value and an overflow flag'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q036', 2, 'For an array-based stack of size MAX_STACK_SIZE, the stack is full when:', ARRAY['top < 0', 'top >= MAX_STACK_SIZE - 1', 'top == MAX_STACK_SIZE', 'top == 0'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q037', 2, 'In the array-doubling strategy for a stack stored in a dynamic array, the total time spent on all array doublings over n push operations is:', ARRAY['O(n^2)', 'O(log n)', 'O(n)', 'O(n log n)'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q038', 2, 'In the infix-to-postfix algorithm using in-stack precedence (isp) and incoming precedence (icp), the left parenthesis has:', ARRAY['High in-stack precedence and low incoming precedence', 'Low in-stack precedence (isp = 0) but high incoming precedence (icp = 20)', 'Equal in-stack and incoming precedence of 0', 'Equal in-stack and incoming precedence of 20'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q039', 2, 'In which notation does the operator appear after its operands, as in A B +?', ARRAY['Postfix (reverse Polish) notation', 'Prefix (Polish) notation', 'Infix notation', 'Parenthesized infix notation'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q040', 2, 'The postfix form of the infix expression a*(b+c)*d is:', ARRAY['ab*c+d*', 'abcd+**', 'abc+*d*', 'abc*+d*'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q041', 2, 'The postfix form of the infix expression a+b*c-d/e is:', ARRAY['ab+c*de/-', 'abc*de/+-', 'abcde*/+-', 'abc*+de/-'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q042', 2, 'What is the value of the postfix expression 5 6 2 + * 12 4 / -?', ARRAY['37', '-37', '43', '3'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q043', 2, 'The prefix form of the infix expression (A + B) * C is:', ARRAY['+ A * B C', 'A B + C *', '* A + B C', '* + A B C'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q044', 2, 'Starting with an empty stack, the operations push(3), push(6), push(9), pop(), push(12), pop(), pop() are performed. What are the values returned by Top() and Size() now?', ARRAY['Top = 6, Size = 2', 'Top = 3, Size = 1', 'Top = 12, Size = 2', 'Top = 9, Size = 1'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q045', 2, 'What is the output of the following code? int stack[10], top = -1, x, y; stack[++top] = 4; stack[++top] = 7; stack[++top] = 2; x = stack[top--]; y = stack[top--]; stack[++top] = x * y; printf("%d %d", stack[top], top);', ARRAY['28 1', '14 1', '14 2', '14 0'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q046', 2, 'A stack uses a dynamically allocated array with an initial capacity of 1 and doubles the capacity (using realloc) whenever a push arrives while the array is full. What is the capacity after 9 pushes?', ARRAY['16', '9', '8', '18'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q047', 2, 'A queue works on which of the following principles?', ARRAY['Last-In-First-Out (LIFO)', 'Highest-priority-last', 'Random access', 'First-In-First-Out (FIFO)'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q048', 2, 'In the array implementation of a linear queue (with f initialized to 0 and r to -1), the queue is empty when:', ARRAY['f < r', 'f > r', 'r == QUEUESIZE - 1', 'f == QUEUESIZE - 1'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q049', 2, 'The figure shows a linear queue stored in an array with QUEUESIZE = 5, f = 2 and r = 4. What happens when insertQ(60, &r, q) is executed? q[ ] 0 1 30 2 40 3 50 4 f r', ARRAY['60 is stored at index 0', '60 is stored at index 5', 'It prints "Queue Empty"', 'It prints "queue overflow" even though locations 0 and 1 are empty'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q050', 2, 'In a circular queue implemented with an array of size QUEUESIZE, the rear is advanced during insertion using:', ARRAY['rear = rear + 1', 'rear = (rear - 1) % QUEUESIZE', 'rear = rear % QUEUESIZE + 1', 'rear = (rear + 1) % QUEUESIZE'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q051', 2, 'A circular queue (QUEUESIZE = 5) uses the variables f, r and count, initially f = 0, r = -1, count = 0. The operations performed are: insert 10, 20, 30, 40; delete twice; insert 50, 60, 70. The final values of f, r and count are:', ARRAY['f = 2, r = 1, count = 5', 'f = 2, r = 2, count = 5', 'f = 0, r = 1, count = 5', 'f = 2, r = 1, count = 3'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q052', 2, 'Elements 9, 4 and 6 are inserted, in this order, into an ascending priority queue. The order in which they are deleted is:', ARRAY['4, 6, 9', '9, 4, 6', '6, 4, 9', '9, 6, 4'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q053', 2, 'A priority queue is mainly used to implement:', ARRAY['Recursion', 'CPU scheduling algorithms', 'Binary search', 'Matrix multiplication'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q054', 2, 'In a deque (double-ended queue), insertion and deletion can be performed:', ARRAY['Only at the front end', 'At both the front and the rear ends', 'Only at the rear end', 'Only in the middle of the queue'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q055', 2, 'In an input-restricted deque:', ARRAY['Deletion is allowed at only one end, while insertion is allowed at both ends', 'Both insertion and deletion are allowed at only one end', 'Insertion is allowed at only one end, while deletion is allowed at both ends', 'Insertion is not allowed at any end'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q056', 2, 'A deque is initially empty. The operations insertFront(1), insertRear(2), insertFront(3), insertRear(4), deleteFront(), deleteRear() are performed in order. The contents of the deque from front to rear are:', ARRAY['3, 1', '2, 4', '1, 2, 4', '1, 2'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q057', 2, 'In the maze problem of the notes, the maze is represented by a two-dimensional array in which:', ARRAY['Ones represent open paths and zeros represent barriers', 'Zeros represent open paths and ones represent barriers', 'Zeros represent the exit and ones the entrance', 'Every position stores the number of its neighbours'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q058', 2, 'To avoid checking border conditions in the maze program, the maze is surrounded by a border of ones. An m x p maze therefore requires an array of size:', ARRAY['m x p', '(m + 1) x (p + 1)', '(m + 2) x (p + 2)', '(m + 2) x p'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q059', 2, 'A 6 x 8 maze is stored in an array with a border of ones. If the entrance is at maze[1][1], the exit is at:', ARRAY['maze[7][9]', 'maze[5][7]', 'maze[8][10]', 'maze[6][8]'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M2-Q060', 2, 'Since each position of an m x p maze is visited no more than once, the worst-case computing time of the maze-path algorithm is:', ARRAY['O(m + p)', 'O((mp)^2)', 'O(mp)', 'O(log mp)'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q061', 3, 'Each node of a singly linked list consists of:', ARRAY['A data field, a prev field and a next field', 'Only a data field', 'Two data fields and a counter', 'A data field and a next (link) field'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q062', 3, 'In a singly linked list, the next field of the last node contains:', ARRAY['The address of the first node', 'The address of the previous node', 'NULL', 'The value zero as data'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q063', 3, 'Which disadvantage of arrays is overcome by using linked lists?', ARRAY['Slow random access to the i-th element', 'Use of a common name for all the elements', 'Inability to store more than one data type', 'Fixed size, and costly insertion and deletion at a given position'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q064', 3, 'While traversing a singly linked list with a pointer current that starts at head, the traversal loop stops when:', ARRAY['current becomes NULL', 'current becomes equal to head again', 'current->data becomes zero', 'current->next points to head'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q065', 3, 'How many types of linked lists are listed in the notes?', ARRAY['2 (singly and doubly)', '4 (singly, doubly, circular singly and circular doubly)', '3 (singly, doubly and circular)', '5'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q066', 3, 'Each node of a doubly linked list consists of:', ARRAY['Data and a pointer to the next node', 'Data and a pointer to the previous node', 'Data, a pointer to the head and a pointer to the tail', 'Data, a pointer to the previous node and a pointer to the next node'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q067', 3, 'Which linked list supports traversal in both the forward and backward directions?', ARRAY['Singly linked list', 'Doubly linked list', 'Circular singly linked list', 'Singly linked list with a tail pointer'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q068', 3, 'In a circular linked list, the last node points to:', ARRAY['NULL', 'The previous node', 'The first node', 'Itself, in every list'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q069', 3, 'In a stack implemented using a singly linked list, push() inserts the new node at the:', ARRAY['End of the list', 'Beginning of the list (top)', 'Middle of the list', 'Position given by the data value'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q070', 3, 'Elements of a linked list are accessed:', ARRAY['Randomly using an index', 'Sequentially, starting from the head', 'Only from the tail', 'Using the memory address of the array base'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q071', 3, 'Which of the following correctly compares arrays and linked lists?', ARRAY['Array: non-contiguous memory and sequential access; Linked list: contiguous memory and random access', 'Both arrays and linked lists use contiguous memory and random access', 'Array: contiguous memory and random access; Linked list: non-contiguous memory and sequential access', 'Both arrays and linked lists use non-contiguous memory and sequential access'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q072', 3, 'In the memory representation of a linked list, the nodes and the pointer variable head declared inside main() are stored, respectively, in the:', ARRAY['Heap and stack', 'Stack and heap', 'Heap and heap', 'Stack and stack'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q073', 3, 'The time required to insert a new node at the end of a singly linked list when only the head pointer is available is:', ARRAY['O(1)', 'O(log n)', 'O(n^2)', 'O(n)'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q074', 3, 'The main advantage of implementing a stack with a linked list instead of an array is that:', ARRAY['Elements can be accessed randomly using an index', 'Memory is allocated contiguously', 'No pointer is needed for the top', 'The stack can grow and shrink dynamically without a fixed maximum capacity'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q075', 3, 'While inserting a new node at the beginning of a non-empty doubly linked list, which statement is required in addition to new_node->next = head?', ARRAY['head->next = new_node', 'new_node->prev = head', 'head->prev = new_node', 'head->prev = NULL'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q076', 3, 'When only a pointer to the node to be deleted is given, the time for deletion in a singly linked list and in a doubly linked list is, respectively:', ARRAY['O(n) and O(1)', 'O(1) and O(n)', 'O(1) and O(1)', 'O(n) and O(n)'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q077', 3, 'Which of the following is a disadvantage of a doubly linked list compared with a singly linked list?', ARRAY['It cannot be traversed in the backward direction', 'Insertion at the beginning requires traversing the whole list', 'Every node needs extra memory for the additional prev pointer', 'It cannot be used to implement a stack or a queue'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q078', 3, 'In a circular singly linked list represented by a pointer last to its last node, the first node is accessed as:', ARRAY['last->prev', 'last->next->next', 'last', 'last->next'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q079', 3, 'In a circular doubly linked list, the prev pointer of the first node stores the address of:', ARRAY['The last node', 'NULL', 'The second node', 'The first node itself'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q080', 3, 'Which of the following is a disadvantage of circular linked lists?', ARRAY['Traversal may enter an infinite loop unless a proper stopping condition is used', 'Insertion at the beginning is impossible', 'They cannot be used to implement a circular queue', 'The last node always contains NULL'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q081', 3, 'Assume the functions of the notes are available. What is the output of the following code? struct Node* head = NULL; head = insertAtBeginning(head, 10); head = insertAtBeginning(head, 20); head = insertAtBeginning(head, 30); head = insertAtEnd(head, 40); traverseLinkedList(head);', ARRAY['10 20 30 40', '40 30 20 10', '30 20 10 40', '30 20 40 10'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q082', 3, 'The singly linked list in the figure is modified by the code below. What does traverseLinkedList(head) print? head = removeLastNode(head); head = removeFirstNode(head); head = deleteAtPosition(head, 2); traverseLinkedList(head); head 12 25 7 40 NULL', ARRAY['25 7', '25', '7', '12'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q083', 3, 'A stack is implemented using a singly linked list as in the notes. Starting from an empty stack, the operations push(11), push(22), push(33), pop(), push(44), push(55), pop(), pop() are performed. What does peek() return?', ARRAY['11', '22', '33', '44'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q084', 3, 'Let tail point to the last node of the final list. What does backwardTraversal(tail) print after the following operations on a doubly linked list? struct Node* head = createNode(10); head = insertEnd(head, 20); head = insertEnd(head, 30); head = insertAtPosition(head, 3, 25);', ARRAY['10 20 25 30', '30 20 25 10', '30 25 10 20', '30 25 20 10'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q085', 3, 'A doubly linked list contains 1, 2, 3, 4, 5. The following statements are executed. If tail points to the last node of the resulting list, what does backwardTraversal(tail) print? head = delPos(head, 3); head = delLast(head); head = delHead(head);', ARRAY['4 2', '2 4', '5 4 2', '4 2 1'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q086', 3, 'What is the output of the following code on a circular singly linked list (insertion functions of the notes)? struct Node *last = NULL; last = insertAtBeginning(last, 10); last = insertEnd(last, 20); last = insertAtBeginning(last, 5); last = insertEnd(last, 30); printf("%d %d", last->data, last->next->data);', ARRAY['30 5', '30 10', '5 30', '20 5'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q087', 3, 'A circular singly linked list contains 5, 10, 20, 30 with last pointing to the node 30. After last = deleteFirstNode(last); last = deleteLastNode(last); what does printf("%d %d", last->data, last->next->data) print?', ARRAY['20 5', '30 10', '20 10', '10 20'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q088', 3, 'Inserting a new node between two existing nodes in the middle of a doubly linked list requires updating how many pointer fields in total?', ARRAY['2', '4', '3', '1'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q089', 3, 'A singly linked list contains the two nodes 7 -> 9 -> NULL. What is the state of the list after head = removeLastNode(head); (the function of the notes)?', ARRAY['An empty list', 'A single node 7 whose next is NULL', 'A single node 9 whose next is NULL', 'The list is unchanged because the loop never executes'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M3-Q090', 3, 'A singly linked list has 4 nodes. For which value of pos does insertPos(head, pos, data) of the notes print "Invalid position!"?', ARRAY['6', '5', '3', '1'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q091', 4, 'Which node of a tree has no parent?', ARRAY['Root node', 'Leaf node', 'Sibling node', 'Internal node'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q092', 4, 'A node with no children (a node of degree zero) is called a:', ARRAY['Root node', 'Internal node', 'Sibling node', 'Leaf (external or terminal) node'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q093', 4, 'A tree with N nodes has how many edges?', ARRAY['N - 1', 'N', 'N + 1', '2N - 1'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q094', 4, 'In the tree shown in the figure, what is the degree of node D? A B C D E F G H I J K L M', ARRAY['2', '4', '3', '1'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q095', 4, 'For the tree shown in the figure, using the convention of the notes (levels, heights and depths counted in edges, with the root at level 0), the depth of node M and the height of node B are, respectively: A B C D E F G H I J K L M', ARRAY['2 and 3', '4 and 2', '3 and 3', '3 and 2'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q096', 4, 'In the left child - right sibling representation of a tree, each node contains:', ARRAY['A data field, a reference to its left (first) child and a reference to its right sibling', 'A data field and references to all of its children', 'A data field, a parent reference and a degree field', 'A data field and a reference to the root'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q097', 4, 'A tree in which every node can have at most two children (a left child and a right child) is called a:', ARRAY['Threaded tree', 'General tree', 'Binary tree', 'Forest'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q098', 4, 'In a strictly binary tree (full binary tree), every node has:', ARRAY['Exactly one child', 'Either zero or two children', 'At most one child', 'Exactly two children, with all leaves at the same level'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q099', 4, 'In a binary tree whose root is on level 1, the maximum number of nodes on level i is:', ARRAY['2^i', '2^(i-1)', '2i - 1', 'i^2'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q100', 4, 'A non-empty binary tree has 7 leaf nodes. The number of nodes having two children is:', ARRAY['6', '7', '8', '3'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q101', 4, 'A strictly binary tree has 15 internal nodes (all of degree 2). The total number of nodes in the tree is:', ARRAY['31', '30', '32', '16'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q102', 4, 'A complete binary tree is stored in a one-dimensional array with the root at index 1. For the node at index 6, which statement is correct?', ARRAY['Parent at index 2, left child at index 12 and right child at index 13', 'Parent at index 3, left child at index 11 and right child at index 12', 'Parent at index 5, left child at index 7 and right child at index 8', 'Parent at index 3, left child at index 12 and right child at index 13'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q103', 4, 'A complete binary tree with 12 nodes is stored in an array with the root at index 1. Which statement is true?', ARRAY['Node 6 has no children', 'Node 6 has a left child (index 12) but no right child', 'Node 5 has no right child', 'The parent of node 12 is node 5'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q104', 4, 'The inorder traversal of a binary tree visits the nodes in the order:', ARRAY['Root, left subtree, right subtree', 'Left subtree, root, right subtree', 'Left subtree, right subtree, root', 'Right subtree, root, left subtree'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q105', 4, 'Which traversal visits the root node after both of its subtrees have been visited?', ARRAY['Preorder', 'Inorder', 'Postorder', 'Level-order'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q106', 4, 'What is the postorder traversal of the binary tree shown in the figure? A B C D F G H I J K', ARRAY['I J D F B K G H C A', 'A B D I J F C G K H', 'I D J B F A G K C H', 'I J D F B G K H C A'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q107', 4, 'The preorder traversal of a binary tree is A B D E C F and its inorder traversal is D B E A F C. Its postorder traversal is:', ARRAY['D B E F C A', 'D E B F C A', 'E D B F C A', 'D E B C F A'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q108', 4, 'An expression tree is built from the postfix expression A B / C * D * E +. Its level-order traversal is:', ARRAY['+ * * / A B C D E', '+ * E * D / C A B', 'A B / C * D * E +', '+ * E * D C / A B'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q109', 4, 'A binary tree has root 4 with a left child 2 and a right child 6 (both leaves). What is the output of the following function when called as trav(root)? void trav(tree_pointer p) { if (p) { printf("%d ", p->data); trav(p->left_child); trav(p->right_child); printf("%d ", p->data); } }', ARRAY['4 2 6 6 2 4', '4 2 6 4', '2 6 4 4 2 6', '4 2 2 6 6 4'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q110', 4, 'Level-order traversal of a binary tree is implemented using a:', ARRAY['Stack', 'Queue', 'Linked list sorted by key', 'Hash table'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q111', 4, 'In the iterative inorder traversal (iter_inorder) of an n-node binary tree, each node is placed on and removed from the stack:', ARRAY['Exactly once, giving O(n) time', 'Exactly twice, giving O(n^2) time', 'log n times, giving O(n log n) time', 'Only if it is a leaf, giving O(log n) time'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q112', 4, 'In a threaded binary tree node, if ptr->leftThread = TRUE, then ptr->leftChild contains:', ARRAY['A pointer to the left child', 'The address of the right sibling', 'A thread, not a pointer to the left child', 'Always NULL'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q113', 4, 'A header node is assumed for all threaded binary trees in order to:', ARRAY['Store the total number of nodes of the tree', 'Convert the tree into a complete binary tree', 'Make the tree a binary search tree', 'Avoid loose (dangling) threads; the original tree becomes the left subtree of the header node'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q114', 4, 'In a binary search tree, for every node:', ARRAY['Keys in its left subtree are larger and keys in its right subtree are smaller than its key', 'All keys in the tree are equal', 'Keys in its left subtree are smaller and keys in its right subtree are larger than its key', 'The left child is always a leaf'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q115', 4, 'If h is the height of a binary search tree, searching for a key (recursively or iteratively) takes:', ARRAY['O(1) time', 'O(h) time', 'O(h^2) time', 'O(n^2) time'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q116', 4, 'In a binary search tree, a new node is always inserted as a:', ARRAY['Root node', 'Internal node', 'Left child of the root', 'Leaf node'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q117', 4, 'The keys 10, 12, 5, 4, 20, 8, 7, 15, 13 are inserted, in this order, into an initially empty binary search tree. Taking the height of a tree with a single node as 0, the height of the resulting tree is:', ARRAY['3', '5', '4', '6'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q118', 4, 'The keys 10, 12, 5, 4, 20, 8, 7, 15, 13 are inserted, in this order, into an initially empty binary search tree. Its preorder traversal is:', ARRAY['10 5 4 8 7 12 20 15 13', '4 5 7 8 10 12 13 15 20', '10 5 12 4 8 20 7 15 13', '10 12 5 4 20 8 7 15 13'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q119', 4, 'To delete a node having two children from a binary search tree, the node is replaced by:', ARRAY['Its parent node', 'The smallest key in its left subtree or the largest key in its right subtree', 'Either the largest key in its left subtree or the smallest key in its right subtree', 'The root of the tree'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M4-Q120', 4, 'In the binary search tree built from the keys 10, 12, 5, 4, 20, 8, 7, 15, 13, the root 10 is deleted by replacing it with the largest key of its left subtree. Which key becomes the replacement?', ARRAY['7', '12', '5', '8'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q121', 5, 'The length of a path in a graph is:', ARRAY['The number of vertices in the path', 'The number of edges in the path', 'The sum of the degrees of its vertices', 'The number of cycles in the path'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q122', 5, 'A graph G = (V, E) consists of:', ARRAY['A set of edges only', 'A set of vertices only, with no relation between them', 'A finite non-empty set of vertices V and a set E of pairs of vertices called edges', 'A set of nodes arranged in levels'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q123', 5, 'In an undirected graph, the pairs (u, v) and (v, u):', ARRAY['Represent two different edges', 'Represent the same edge', 'Represent a self loop', 'Cannot both be present in the graph'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q124', 5, 'How many edges does a complete undirected graph with 6 vertices have?', ARRAY['30', '12', '21', '15'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q125', 5, 'An edge of the form (v, v), which starts and ends at the same vertex, is called a:', ARRAY['Multi-edge', 'Cycle of length two', 'Weighted edge', 'Self loop (self edge)'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q126', 5, 'For the directed graph shown in the figure, the in-degree and the out-degree of vertex c are, respectively: a b d c', ARRAY['1 and 2', '2 and 1', '2 and 2', '3 and 1'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q127', 5, 'A directed graph G is said to be strongly connected if:', ARRAY['For every pair of distinct vertices u and v there is a directed path from u to v and from v to u', 'It contains no cycles', 'Every vertex has at least one outgoing edge', 'Every vertex has in-degree equal to its out-degree'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q128', 5, 'The adjacency matrix of an undirected graph is always:', ARRAY['Symmetric', 'Upper triangular', 'A diagonal matrix', 'An identity matrix'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q129', 5, 'For an undirected graph with n vertices and e edges, the adjacency list representation requires an array of size n and how many chain nodes?', ARRAY['e', 'n + e', 'n^2', '2e'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q130', 5, 'In the adjacency multilist representation of a graph:', ARRAY['Each edge is represented by two nodes, one in each end vertex''s list', 'Each vertex is represented by n nodes', 'Only the edge weights are stored, not the vertices', 'Each edge is represented by exactly one node, which appears in the lists of both of its end vertices'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q131', 5, 'Which data structure is used to maintain the current position in the adjacency lists during depth first search?', ARRAY['Queue', 'Priority queue', 'Stack', 'Hash table'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q132', 5, 'Breadth first search of a graph uses which data structure to hold the visited vertices whose adjacency lists are yet to be examined?', ARRAY['Stack', 'Queue', 'Binary tree', 'Array of weights'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q133', 5, 'For a graph with n vertices and e edges, the time taken by depth first search when the graph is represented by an adjacency list and by an adjacency matrix is, respectively:', ARRAY['O(e) and O(n^2)', 'O(n^2) and O(e)', 'O(n) and O(n)', 'O(e) and O(e)'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q134', 5, 'A depth first search is started from vertex 0 of the undirected graph in the figure. The adjacency lists are 0: 1, 2; 1: 0, 3, 4; 2: 0, 4; 3: 1; 4: 1, 2, and the vertices of each list are examined in the given order. The vertices are visited in the order: 0 1 2 3 4', ARRAY['0 1 3 4 2', '0 1 2 3 4', '0 2 4 1 3', '0 1 4 2 3'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q135', 5, 'A directed graph has the adjacency lists 0: 2, 1, 3; 1: 4; 2: 5, 4; 3: 5; 4: 6; 5: 6; 6: (none). A breadth first search is started from vertex 0 and the adjacency lists are scanned in the given order. The vertices are visited in the order:', ARRAY['0 1 2 3 4 5 6', '0 2 1 3 5 4 6', '0 2 5 6 4 1 3', '0 2 1 3 4 5 6'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q136', 5, 'Insertion sort (as given in the notes) is applied to the list 5, 2, 4, 6, 1, 3. The total number of times an element is shifted one position to the right (a[i+1] = a[i]) during the sort is:', ARRAY['9', '10', '8', '15'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q137', 5, 'Radix sort (least significant digit first, with each bucket preserving the input order) is applied to 348, 143, 361, 423, 538, 128, 321, 543, 366. The list after the first pass (units digit) is:', ARRAY['321 361 143 423 543 366 538 348 128', '128 143 321 348 361 366 423 538 543', '361 321 143 423 543 366 348 538 128', '348 143 361 423 538 128 321 543 366'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q138', 5, 'If each number in a list has s digits (radix d), the radix sort algorithm requires:', ARRAY['d passes', 's passes', 'n passes', 'log n passes'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q139', 5, 'The function f used in address calculation sort must be order preserving, which means:', ARRAY['If x <= y then f(x) <= f(y)', 'If x <= y then f(x) >= f(y)', 'f(x) is different for every key x', 'f(x) is chosen randomly for every key'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q140', 5, 'In hashing, a collision occurs when:', ARRAY['A key is not found in the hash table', 'The hash table becomes empty', 'Two or more keys map to the same memory location', 'The hash function returns a negative value'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q141', 5, 'In the division method of hashing, the hash function is:', ARRAY['h(x) = x div M', 'h(x) = x * M', 'h(x) = M - x', 'h(x) = x mod M'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q142', 5, 'A hash table of size 10 uses H(k) = k mod 10 with linear probing. The keys 72, 27, 36, 24, 63, 81, 92, 101 are inserted in this order. At which index is the key 101 stored?', ARRAY['5', '8', '1', '9'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q143', 5, 'The keys 72, 27, 36, 24, 63, 81, 92, 101 are stored, in this order, in a hash table of size 10 using H(k) = k mod 10 and linear probing. The average search length (total probes needed to find all 8 keys divided by 8) is:', ARRAY['2.0', '1.5', '2.25', '3.0'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q144', 5, 'A hash table of size 10 uses H(k) = k mod 10 with quadratic probing (probes h, h+1, h+4, h+9, ...). The keys 22, 32 and 42 are inserted in this order. At which index is 42 stored?', ARRAY['4', '3', '5', '6'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q145', 5, 'Double hashing with H1(key) = key % 10 and H2(key) = 7 - (key % 7) is used, and a collision is resolved with (H1(key) + i x H2(key)) % 10. The keys 37, 90, 45, 22, 17, 49, 55 are inserted in this order. At which index is the key 17 stored?', ARRAY['1', '8', '4', '7'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q146', 5, 'Using the folding method for a hash table with 100 locations, the key 123456 is divided into the parts 12, 34 and 56, which are added, ignoring any carry. The hash value is:', ARRAY['102', '12', '56', '2 (that is, 02)'], 4, 'Official answer key: D', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q147', 5, 'Words are stored using chaining in a table of size 5 with H(str) = (sum of the positions of its letters in the English alphabet) % 5. The words like, a, tree, you, first, a, place, to are inserted in this order at the rear of their chains. The words in the chain of index 2 are:', ARRAY['a, you, a', 'tree, first, place', 'like, first, place', 'like, tree, place'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q148', 5, 'In rehashing, when the hash table becomes nearly full:', ARRAY['The entries are copied to the same positions of a bigger table', 'A new table of double the size is created and every entry is re-inserted using its newly computed hash value', 'The size of the table is halved and the entries are rehashed', 'All the chains are deleted and the table is emptied'], 2, 'Official answer key: B', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q149', 5, 'Which of the following is a drawback of static hashing?', ARRAY['The table size is fixed, so it cannot accommodate data growth and collisions increase as the data grows', 'It requires a directory of pointers that must be doubled', 'It cannot use chaining or linear probing', 'The hash function cannot be computed in constant time'], 1, 'Official answer key: A', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, 'OS-M5-Q150', 5, 'Which statement about dynamic hashing is correct?', ARRAY['Linear hashing uses a directory that is doubled, whereas extendible hashing splits buckets in round-robin order', 'Both extendible and linear hashing use a table of fixed size', 'Extendible hashing uses a directory that is doubled, splitting only the bucket that overflowed, whereas linear hashing uses no directory and splits buckets in round-robin order', 'Extendible hashing needs overflow pages, whereas linear hashing needs none'], 3, 'Official answer key: C', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;


END $$;
