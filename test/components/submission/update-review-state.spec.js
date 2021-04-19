import SubmissionAuditRow from '../../../src/components/submission/audit/row.vue';
import SubmissionUpdateReviewState from '../../../src/components/submission/update-review-state.vue';

import testData from '../../data';
import { load, mockHttp } from '../../util/http';
import { mockLogin } from '../../util/session';
import { mount } from '../../util/lifecycle';
import { trigger } from '../../util/event';

const mountOptions = (options = undefined) => {
  const { xmlFormId } = testData.extendedForms.last();
  const submission = testData.submissionOData();
  return {
    propsData: {
      state: true,
      projectId: '1',
      xmlFormId,
      instanceId: submission.value[0].__id
    },
    requestData: { submission },
    ...options
  };
};
const mountComponent = (options = undefined) =>
  mount(SubmissionUpdateReviewState, mountOptions(options));
const mockHttpForComponent = (options = undefined) =>
  mockHttp().mount(SubmissionUpdateReviewState, mountOptions(options));

describe('SubmissionUpdateReviewState', () => {
  beforeEach(mockLogin);

  it('toggles the modal', () => {
    testData.extendedSubmissions.createPast(1, { instanceId: 's' });
    testData.extendedAudits.createPast(1, { action: 'submission.create' });
    return load('/projects/1/forms/f/submissions/s', { root: false })
      .testModalToggles({
        modal: SubmissionUpdateReviewState,
        show: '#submission-audit-list-update-review-state-button',
        hide: '.btn-link'
      });
  });

  describe('review state selection', () => {
    it('sets the selection to the current review state', () => {
      testData.extendedSubmissions.createPast(1, { reviewState: 'hasIssues' });
      const radio = mountComponent().first('input[value="hasIssues"]');
      radio.element.checked.should.be.true();
    });

    it('sets the selection to approved if current review state is null', () => {
      testData.extendedSubmissions.createPast(1, { reviewState: null });
      const radio = mountComponent().first('input[value="approved"]');
      radio.element.checked.should.be.true();
    });

    it('sets the selection to approved if current review state is edited', () => {
      testData.extendedSubmissions.createPast(1, { reviewState: 'edited' });
      const radio = mountComponent().first('input[value="approved"]');
      radio.element.checked.should.be.true();
    });
  });

  it('focuses the review state radio', () => {
    testData.extendedSubmissions.createPast(1, { reviewState: 'hasIssues' });
    const modal = mountComponent({ attachToDocument: true });
    modal.first('input[value="hasIssues"]').should.be.focused();
  });

  describe('resetting the form', () => {
    it('resets the form after the modal is hidden', async () => {
      testData.extendedSubmissions.createPast(1, { reviewState: 'hasIssues' });
      const modal = mountComponent();
      await trigger.check(modal, 'input[value="rejected"]');
      await trigger.input(modal, 'textarea', 'Some notes');
      modal.setProps({ state: false });
      await modal.vm.$nextTick();
      modal.setProps({ state: true });
      await modal.vm.$nextTick();
      modal.first('input[value="hasIssues"]').element.checked.should.be.true();
      modal.first('textarea').element.value.should.equal('');
    });

    it('resets review state to approved if current state is null', async () => {
      testData.extendedSubmissions.createPast(1, { reviewState: null });
      const modal = mountComponent();
      await trigger.check(modal, 'input[value="hasIssues"]');
      modal.setProps({ state: false });
      await modal.vm.$nextTick();
      modal.setProps({ state: true });
      await modal.vm.$nextTick();
      modal.first('input[value="approved"]').element.checked.should.be.true();
    });
  });

  describe('request', () => {
    it('sends the correct request', () => {
      testData.extendedForms.createPast(1, {
        xmlFormId: 'a b',
        submissions: 1
      });
      testData.extendedSubmissions.createPast(1, {
        instanceId: 'c d',
        reviewState: null
      });
      return mockHttpForComponent()
        .request(trigger.submit('form', [['input[value="hasIssues"]', true]]))
        .beforeEachResponse((_, { method, url, data }) => {
          method.should.equal('PATCH');
          url.should.equal('/v1/projects/1/forms/a%20b/submissions/c%20d');
          data.should.eql({ reviewState: 'hasIssues' });
        })
        .respondWithProblem();
    });

    it('sends an X-Action-Notes header if there are notes', () => {
      testData.extendedSubmissions.createPast(1, { reviewState: null });
      return mockHttpForComponent()
        .request(trigger.submit('form', [['textarea', 'Some\nnotes']]))
        .beforeEachResponse((_, { headers }) => {
          headers['X-Action-Notes'].should.equal('Some%0Anotes');
        })
        .respondWithProblem();
    });
  });

  it('implements some standard button things', () => {
    testData.extendedSubmissions.createPast(1, { reviewState: null });
    return mockHttpForComponent().testStandardButton({
      button: '.btn-primary',
      request: trigger.submit('form'),
      disabled: ['.btn-link'],
      modal: true
    });
  });

  describe('after a successful response', () => {
    const submit = () => {
      testData.extendedForms.createPast(1, { xmlFormId: 'a b' });
      testData.extendedSubmissions.createPast(1, {
        instanceId: 'c d',
        reviewState: null
      });
      testData.extendedAudits.createPast(1, { action: 'submission.create' });
      return load('/projects/1/forms/a%20b/submissions/c%20d', { root: false })
        .complete()
        .request(async (component) => {
          await trigger.click(component, '#submission-audit-list-update-review-state-button');
          return trigger.submit(component, '#submission-update-review-state form', [
            ['input[value="hasIssues"]', true]
          ]);
        })
        .respondWithData(() => {
          testData.extendedSubmissions.update(-1, { reviewState: 'hasIssues' });
          testData.extendedAudits.createPast(1, {
            action: 'submission.update',
            details: { reviewState: 'hasIssues' }
          });
          return testData.standardSubmissions.last();
        })
        .respondWithData(() => testData.extendedAudits.sorted());
    };

    it('sends the correct request for the audit log entries', () =>
      submit().beforeEachResponse((_, { method, url, index }) => {
        if (index === 1) {
          method.should.equal('GET');
          url.should.equal('/v1/projects/1/forms/a%20b/submissions/c%20d/audits');
        }
      }));

    it('hides the modal', async () => {
      const component = await submit();
      const modal = component.first(SubmissionUpdateReviewState);
      modal.getProp('state').should.be.false();
    });

    it('shows a success alert', async () => {
      const component = await submit();
      component.should.alert('success');
    });

    it('updates the store', async () => {
      const component = await submit();
      const { submission } = component.vm.$store.state.request.data;
      submission.__system.reviewState.should.equal('hasIssues');
      // Check that other properties were copied correctly.
      submission.__id.should.equal('c d');
      submission.__system.submitterId.should.equal('1');
    });

    it('updates the number of rows in the table', async () => {
      const component = await submit();
      component.find(SubmissionAuditRow).length.should.equal(2);
    });
  });
});
