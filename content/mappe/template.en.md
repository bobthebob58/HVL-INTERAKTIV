<!--
  content/mappe/template.en.md: the English template of the pedagogisk mappe export (spec 04 §7, MAPPE-002, D-094).

  DRAFT, not confirmed by ALU (open question Q17). Translated from template.nn.md, which is the reference: the sources
  of every HVL rule are in its notes and in docs/reference/hvl-pedagogisk-mappe-criteria.md. HVL's own names (the
  «Lederuttalelse» template, merittert undervisar) stay in Norwegian, so an English-speaking teacher finds them in
  HVL's call.

  Keep the same markers, lists, values and headings as template.nn.md (content/mappe/README.md). Run
  `npm run content:check` after every change.

  PRIVACY (MAPPE-003): no learner identifiers, free-text answers or individual scores anywhere in this file.
  PEDAGOGY: H5P results are formative only (CLAUDE.md §1); the notice under the title must stay.
-->

# Teaching portfolio

{{forfattar}} · {{dato}}

> **Draft from HVL Interaktiv.** This is a starting point, not a finished portfolio. Text in *italics* is
> guidance: replace it with your own text. Figures about students are anonymised summaries for groups of at least
> {{k}} students. Results from H5P activities are formative and are not evidence of exam results.

*The criteria in this portfolio come from the criteria set “{{kriteriesett}}”. HVL revises the criteria for every
call, so check the criteria, the word limit and the number of attachments in the call you apply to.*

## Reader’s guide: criteria and documentation

*The table shows where in the portfolio you answer each criterion, and which attachments document it. Fill in the
attachments once you have chosen them.*

{{lesarrettleiing}}

{{del1_start}}

# Part 1 – Continuous text

*Word count for Part 1: {{ordtal_del1}} of {{ordgrense}} words. The references do not count towards the limit.
The count is for this file as HVL Interaktiv made it, including the guidance in italics. Count the words again once
you have written your text.*

## 1 My view of teaching and learning design

*Describe briefly how you think about students’ learning. How do you use HVL’s model for learning design, with
context, knowledge and co-creation, when you plan your courses? How does the work before, during and after the
sessions fit together? Which research and theory do you build on?*

## 2 Students’ learning process

### 2.1 Experience of teaching and supervision

*Which courses and groups of students have you taught and supervised? How does your practice support students’
learning process?*

The activities in this portfolio by course, with the number of activities and how many there are in each phase:

{{#emneoversikt}}
- **{{emnekode}}:** {{tal}} ({{fasar}})
{{/emneoversikt}}

### 2.2 Systematic development over time

*What have you changed in your teaching over time, and why? You may point to activities you have revised. Each
activity in chapter 3.3 shows when you made it and when you last changed it.*

### 2.3 Feedback from students and colleagues

*How do you collect feedback from students and colleagues? What have you changed because of it? The summaries of
the activities in chapter 3.3 can be part of the evidence.*

### 2.4 Working together to develop teaching

*Who have you worked with to develop your teaching, for example students, colleagues or management? Why did this
collaboration matter?*

You made {{samarbeid_tal}} of the {{aktivitetar_tal}} activities in this portfolio together with co-authors.

## 3 A scientific approach to teaching

### 3.1 Exploratory and systematic development work

*Describe a piece of development work in which you tried something new, collected data and assessed the effect.
What was your question, what did you do, and what did you find?*

### 3.2 Choices grounded in research and theory

*Explain your most important choices with research and theory. The patterns you have used cite research you can
build on. You will find it under References.*

### 3.3 Forms of teaching and assessment, and varied learning materials

*The activities below are digital learning materials you have made in HVL Interaktiv, alone or with others. Choose
the ones that best show how you develop and try out forms of teaching and assessment.*

*The link to an activity opens it only for people who may view it: only you and your co-authors can open a draft or
a private activity. Before you submit the portfolio, publish the activities you refer to and choose «Everyone with a
Feide login» on the «Sharing» tab, so that assessors outside HVL can open them too. If you would rather not share an
activity that way, attach screenshots instead.*

{{resultat_merknad}}

{{#aktivitetar}}

#### {{tittel}}

- **Content type:** {{innhaldstype}} ({{status}})
- **Phase:** {{fase}}
- **Course:** {{emne}}
- **Learning outcomes:** {{laeringsutbytte}}
- **Didactic rationale:** {{grunngjeving}}
- {{uu_status}}
{{#uu_merknader}}
  - {{alvor}}: {{melding}} ({{uu_grunngjeving}})
{{/uu_merknader}}
- **Dates:** made {{oppretta}}, last changed {{endra}}
- **Link:** {{lenke}}
- **Anonymised results (formative):** {{resultat}}

*Reflection: What did you learn from this activity, and what will you change next time?*

{{/aktivitetar}}

### 3.4 Sharing expertise from your teaching work

*How have you shared what you have learnt about teaching, for example in articles, at conferences, in reports or
in internal forums?*

## 4 A collegial attitude and sharing of experience

### 4.1 Sharing and professional communities

*How do you share experience with management, colleagues, students or others? How has this helped to build
professional communities around quality in teaching?*

### 4.2 Study programme work and development work

*Have you initiated, played a central part in or led work on study programmes, educational or subject-didactic
development work, study quality work or reviews? How does this work connect with HVL’s strategic plans?*

### 4.3 A reasoned plan for further development

*What do you want to develop further in your own teaching and in your academic community, and why? What role do you
see for yourself as a merited teacher (merittert undervisar)?*

{{del1_slutt}}

## References

*HVL Interaktiv fills in the references of the patterns your activities are built on. Add the ones you cite
yourself in Part 1.*

{{referansar}}

# Part 2 – Teaching CV: input

*You can use HVL’s teaching CV template, “Pedagogisk CV”, or your own CV. Paste in what fits from the list
below.*

## Development of digital learning resources

{{#aktivitetar}}
- {{tittel}} ({{innhaldstype}}, {{emne}}), made {{oppretta}}
{{/aktivitetar}}

# Part 3 – Suggested attachments

*You can attach up to {{maks_vedlegg}} documents. One of them must be a letter of recommendation from your manager.
Refer to every attachment in the portfolio. The teaching CV and figures in the text do not count as attachments.*

{{vedlegg_start}}

1. **Letter of recommendation from your manager.** It is required. Use HVL’s template “Lederuttalelse”. HVL
   Interaktiv does not make this attachment.
2. **Documentation and examples of learning resources you have developed**, for example these activities:
{{#aktivitetar}}
   - {{tittel}}
{{/aktivitetar}}
3. **A summary of and reflection on feedback from students.** Figures from HVL Interaktiv are anonymised and cover
   groups of at least {{k}} students.
4. **A report on developing a course or study programme.**

{{vedlegg_slutt}}
